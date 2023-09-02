import fs from 'node:fs';
import path from 'node:path';

import cpy from 'cpy';
import { cruise, IDependency } from 'dependency-cruiser';
import express from 'express';
import { glob } from 'glob';
import { mkdirpSync } from 'mkdirp';
import React, {
  ComponentType,
  isValidElement,
  ReactElement,
  ReactNode,
} from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Helmet } from 'react-helmet';
import { rimrafSync } from 'rimraf';

import { PORT } from '../../constants.js';
import type { RequestMethod } from '../../index.js';
import type { EmptyObject } from '../../types.js';

const root = 'src/';
const staticDir = 'static/';
const publicFiles = 'public/**/*';
const MATCHES_LOCAL = /^[./]/;
const cwd = process.cwd();

type UnknownObject = Record<string, unknown>;

type AssertUnknownObject = (
  module: unknown,
  pathname: string
) => asserts module is UnknownObject;

// const resolvePromises = async (
//   promises: readonly ((() => Promise<any>) | Promise<any>)[]
// ) => {
//   const copy = [...promises];

//   while (copy.length) {
//     const current = copy.shift();

//     if (current instanceof Promise) {
//       await current;
//     } else if (typeof current === 'function') {
//       await current();
//     }
//   }
// };

type AsyncComponent<P = EmptyObject> = (props: P) => Promise<ReactElement>;
type ComponentLike = ComponentType | AsyncComponent;

const isAsyncFunction = (value: ComponentLike): value is AsyncComponent => {
  return value.constructor.name === 'AsyncFunction';
};

const AsyncComponentWrapper = ({
  children,
}: {
  children: ReactNode | readonly ReactNode[];
}) => <>{children}</>;

const createElementAsync = async (
  Comp: ComponentLike,
  props: UnknownObject
) => {
  if (isAsyncFunction(Comp)) {
    const element = await Comp(props);

    return <AsyncComponentWrapper {...props}>{element}</AsyncComponentWrapper>;
  }

  return <Comp {...props} />;
};

const isComponentLike = (value: unknown): value is ComponentLike =>
  typeof value === 'function';

const MaybeHead = ({
  clientModule,
  client,
  children,
}: {
  clientModule: UnknownObject;
  client: string;
  children: ReactNode | readonly ReactNode[];
}) => {
  if (!('title' in clientModule)) {
    return <Helmet>{children}</Helmet>;
  }

  const { title } = clientModule;

  if (!(typeof title === 'string' || typeof title === 'number')) {
    throw new Error(`Title must be a string or number in "${client}"`);
  }

  return (
    <Helmet>
      <title>{title}</title>
      {children}
    </Helmet>
  );
};

const assertModule: AssertUnknownObject = (module, pathname) => {
  if (!module) {
    throw new Error(
      `Module at "${pathname}" was not what we expected: ${module}`
    );
  }

  if (typeof module !== 'object' || Array.isArray(module)) {
    throw new Error(`Module at "${pathname}" must be an object`);
  }
};

const assertProps: AssertUnknownObject = (props, pathname) => {
  if (!props) {
    throw new Error(`Props from "${pathname}" was no truthy: ${props}`);
  }

  if (typeof props !== 'object' || Array.isArray(props)) {
    throw new Error(`Props from "${pathname}" must be an object`);
  }
};

const buildStatic = async () => {
  const serverFiles = glob
    .sync(`${root}**/*.server.{ts,tsx,js,jsx,mjs,cjs}`, { cwd })
    .map((pathname) => path.relative(root, pathname))
    // FIXME: remove these filters for slugs
    .filter((pathname) => !pathname.includes('${'));
  const clientFiles = glob
    .sync(`${root}**/*.client.{ts,tsx,js,jsx,mjs,cjs}`, { cwd })
    .map((pathname) => path.relative(root, pathname))
    // FIXME: remove these filters for slugs
    .filter((pathname) => !pathname.includes('${'));
  // const layoutFiles = glob
  //   .sync(`${root}**/*.layout.{ts,tsx,js,jsx,mjs,cjs}`, { cwd })
  //   .map((pathname) => path.relative(root, pathname))
  //   // FIXME: remove these filters for slugs
  //   .filter((pathname) => !pathname.includes('${'));

  const app = express();

  const serverPromises = serverFiles.map(async (server) => {
    const serverModule: unknown = await import(path.join(cwd, root, server));

    assertModule(serverModule, server);

    Object.entries(serverModule).forEach(([fn, callback]) => {
      const match = /^(get|put|post|patch|delete|options)/.exec(fn);

      if (match && typeof callback === 'function') {
        const [, methodName] = match;

        const resolvedPathname = `/api/${server
          .replace(/\.server\..+$/, '')
          .replace(/index$/, '')
          .replace(/\/?$/g, '/')}${fn}`.replace(/\/+/g, '/');

        app[methodName as RequestMethod](resolvedPathname, async (req, res) => {
          const data = await callback(req);

          res.json(data);
        });
      }
    });
  });

  await Promise.all(serverPromises);

  const getProps = async (clientModule: UnknownObject, pathname: string) => {
    if (!('getProps' in clientModule)) {
      return {};
    }

    if (typeof clientModule.getProps !== 'function') {
      throw new Error(
        `Exported "getProps" must be a function in "${clientModule}"`
      );
    }

    const props = await clientModule.getProps();

    assertProps(props, pathname);

    return props;
  };

  const dependencies = await cruise(
    clientFiles.map((pathname) => path.resolve(root, pathname)),
    {
      baseDir: cwd,
    }
  );

  const nodeModules = dependencies.output.modules
    .reduce<readonly IDependency[]>((acc, mod) => {
      return [
        ...acc,
        ...mod.dependencies.filter((dep) =>
          dep.resolved.includes('node_modules')
        ),
      ];
    }, [])
    .filter(
      (dep, index, context) =>
        context.findIndex(
          (otherDep) =>
            otherDep.module === dep.module && otherDep.resolved === dep.resolved
        ) === index
    );

  rimrafSync(path.resolve(cwd, staticDir));
  mkdirpSync(path.resolve(cwd, staticDir));
  cpy(publicFiles, path.resolve(cwd, staticDir));
  nodeModules.forEach((dep) => {
    cpy(
      dep.resolved,
      path.resolve(
        staticDir,
        'node_modules',
        path.dirname(dep.resolved.replace(/^.*node_modules\//, ''))
      ),
      { cwd }
    );
  });

  const expressServer = app.listen(PORT, async () => {
    const clientPromises = clientFiles.map(async (client) => {
      const clientModule: unknown = await import(path.join(cwd, root, client));

      assertModule(clientModule, client);

      const props = await getProps(clientModule, client);

      if (!('default' in clientModule)) {
        throw new Error(`Must have a default export in "${client}"`);
      }

      const { default: Comp } = clientModule;

      if (!isComponentLike(Comp)) {
        throw new Error(
          `Default export must be a React component in "${client}"`
        );
      }

      const element: unknown = await createElementAsync(Comp, props);

      if (!isValidElement(element)) {
        throw new Error(
          `Default export must return a valid React element in "${client}"`
        );
      }

      const staticMarkup = renderToStaticMarkup(
        <>
          <MaybeHead clientModule={clientModule} client={client}>
            <script type="importmap">
              {JSON.stringify({
                imports: nodeModules
                  .filter((dep) => !MATCHES_LOCAL.test(dep.module))
                  .reduce(
                    (acc, dep) => ({
                      ...acc,
                      [dep.module]: dep.resolved.replace(
                        /^.*node_modules\//,
                        '/node_modules/'
                      ),
                    }),
                    {}
                  ),
              })}
            </script>
            <script type="application/json">
              {JSON.stringify({
                client: client
                  .replace(/\.tsx?/, '.js')
                  .replace(/^(\.?\/)?/, '/'),
              })}
            </script>
          </MaybeHead>
          {element}
        </>
      );
      const helmet = Helmet.renderStatic();
      const htmlAttributes = helmet.htmlAttributes.toString();
      const bodyAttributes = helmet.bodyAttributes.toString();

      const html = `<!DOCTYPE html>
<html${htmlAttributes ? ` ${htmlAttributes}` : ''}>
  <head>
    ${[
      helmet.title.toString(),
      helmet.meta.toString(),
      helmet.link.toString(),
      helmet.style.toString(),
      helmet.script.toString(),
    ]
      .filter((str) => str)
      .join('\n    ')}
  </head>
  <body${bodyAttributes ? ` ${bodyAttributes}` : ''}>
    ${staticMarkup}
  </body>
</html>
`;

      const outFile = path.resolve(
        cwd,
        staticDir,
        client
          .replace(/\.client\..+/, '.html')
          .replace(/(^|\/)([^/]+)\.html$/, (match, pre, name) => {
            if (name !== 'index') {
              return `${pre}${name}/index.html`;
            }

            return match;
          })
      );

      // eslint-disable-next-line no-console
      console.log(`Created ${path.relative(cwd, outFile)}`);

      const ourDir = path.dirname(outFile);

      mkdirpSync(ourDir);

      fs.writeFileSync(outFile, html, 'utf8');
    });

    await Promise.all(clientPromises);

    // eslint-disable-next-line no-console
    console.log('Closing...');

    expressServer.close();
  });
};

export default buildStatic;
