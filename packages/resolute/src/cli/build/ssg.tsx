import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import url from 'node:url';

import { transformSync } from '@babel/core';
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
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { Helmet } from 'react-helmet';
import { rimrafSync } from 'rimraf';

import { PORT } from '../../constants.js';
import type { RequestMethod } from '../../index.js';
import type { EmptyObject } from '../../types.js';
import { compileTypeScript } from '../utils/compile.js';

// const __filename = url.fileURLToPath(import.meta.url);
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
const require = createRequire(import.meta.url);

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
  children?: ReactNode | readonly ReactNode[];
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
    clientFiles
      .map((pathname) => path.resolve(root, pathname))
      .concat(
        path.relative(cwd, path.resolve(__dirname, '../../resolute-client.tsx'))
      ),
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
  await cpy(publicFiles, path.resolve(cwd, staticDir));
  await Promise.all(
    nodeModules.map(async (dep) => {
      const outPath = path.resolve(
        cwd,
        staticDir,
        dep.resolved.replace(/^.*node_modules\//, 'node-modules/')
      );

      mkdirpSync(path.dirname(outPath));
      const content = fs.readFileSync(dep.resolved, {
        encoding: 'utf8',
      });
      // const sourceMapMatch = /\/\/#\ssourceMappingURL=([^\s]+)[\s\n]*$/.exec(
      //   content
      // );
      // const sourceMapUrl =
      //   (sourceMapMatch && sourceMapMatch[1]) ||
      //   `${path.basename(dep.resolved)}.map`;
      process.env.NODE_ENV = 'production';
      const babelResult = transformSync(content, {
        filename: dep.resolved,
        plugins: [
          [
            require.resolve(
              'babel-plugin-transform-inline-environment-variables'
            ),
            { include: ['NODE_ENV'] },
          ],
          require.resolve('babel-plugin-minify-dead-code-elimination'),
          require.resolve('babel-plugin-transform-commonjs'),
        ],
        minified: true,
      });

      if (!babelResult) {
        throw new Error(`No babel result for "${dep.resolved}"`);
      }

      const { code } = babelResult;

      if (!code) {
        throw new Error(`No babel code for "${dep.resolved}"`);
      }

      fs.writeFileSync(
        outPath,
        code.replace(
          /(import\s+[\w]+\s+from\s*["']\.\/cjs\/react\.(production|development)\.min\.js["'];)/,
          `$1export * from"./cjs/react.$2.min.js";`
        ),
        { encoding: 'utf8' }
      );
    })
  );
  const clientRoot = path.resolve(cwd, root);
  compileTypeScript(
    clientFiles.map((pathname) => path.resolve(clientRoot, pathname)),
    clientRoot,
    path.resolve(cwd, staticDir)
  );
  const resoluteClientRoot = path.resolve(__dirname, '../../');
  compileTypeScript(
    [path.resolve(resoluteClientRoot, 'resolute-client.tsx')],
    resoluteClientRoot,
    path.resolve(cwd, staticDir)
  );
  compileTypeScript(
    [path.resolve(resoluteClientRoot, 'index.ts')],
    resoluteClientRoot,
    path.resolve(cwd, staticDir, 'node-modules', '@blinkorb/resolute')
  );

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

      const staticHead = renderToStaticMarkup(
        <MaybeHead clientModule={clientModule} client={client} />
      );

      const appMarkup = renderToString(element);

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
    ${staticHead}
    <script type="importmap">
      ${JSON.stringify({
        imports: nodeModules
          .filter((dep) => !MATCHES_LOCAL.test(dep.module))
          .reduce(
            (acc, dep) => ({
              ...acc,
              [dep.module]: dep.resolved.replace(
                /^.*node_modules\//,
                '/node-modules/'
              ),
            }),
            {
              '@blinkorb/resolute': '/node-modules/@blinkorb/resolute/index.js',
            }
          ),
      })}
    </script>
    <script id="resolute-client-json" type="application/json">
      ${JSON.stringify({
        client: client.replace(/\.tsx?/, '.js').replace(/^(\.?\/)?/, '/'),
      })}
    </script>
    <script defer type="module" src="/resolute-client.js"></script>
  </head>
  <body${bodyAttributes ? ` ${bodyAttributes}` : ''}>${appMarkup}</body>
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

      fs.writeFileSync(outFile, html, { encoding: 'utf8' });
    });

    await Promise.all(clientPromises);

    // eslint-disable-next-line no-console
    console.log('Closing...');

    expressServer.close();
  });
};

export default buildStatic;
