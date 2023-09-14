import fs from 'node:fs';
import path from 'node:path';

import cpy from 'cpy';
import express from 'express';
import { glob } from 'glob';
import { mkdirpSync } from 'mkdirp';
import React, { ReactNode } from 'react';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { Helmet } from 'react-helmet';
import { rimrafSync } from 'rimraf';

import type { RequestMethod } from '../../index.js';
import { UnknownObject } from '../../types.js';
import { getModuleElement, getProps } from '../../utils/component.js';
import { getModule } from '../../utils/module.js';
import {
  CWD,
  MATCHES_LOCAL,
  MATCHES_NODE_MODULE,
  PUBLIC_FILES_GLOB,
  SRC_DIR,
  SRC_PATHNAME,
  STATIC_PATHNAME,
} from '../constants.js';
import { compileBabel, compileTypeScript } from '../utils/compile.js';
import { getAllDependencies } from '../utils/deps.js';

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

const buildStatic = async () => {
  const serverFiles = glob
    .sync(`${SRC_DIR}**/*.server.{ts,tsx,js,jsx,mjs,cjs}`, { cwd: CWD })
    .map((pathname) => path.relative(SRC_DIR, pathname))
    // FIXME: remove these filters for slugs
    .filter((pathname) => !pathname.includes('${'));
  const clientFiles = glob
    .sync(`${SRC_DIR}**/*.client.{ts,tsx,js,jsx,mjs,cjs}`, { cwd: CWD })
    .map((pathname) => path.relative(SRC_DIR, pathname))
    // FIXME: remove these filters for slugs
    .filter((pathname) => !pathname.includes('${'));
  // const layoutFiles = glob
  //   .sync(`${root}**/*.layout.{ts,tsx,js,jsx,mjs,cjs}`, { cwd })
  //   .map((pathname) => path.relative(root, pathname))
  //   // FIXME: remove these filters for slugs
  //   .filter((pathname) => !pathname.includes('${'));

  const app = express();

  const serverPromises = serverFiles.map(async (server) => {
    const serverModule = await getModule(path.join(CWD, SRC_DIR, server));

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

  const { list } = await getAllDependencies(
    clientFiles
      .map((pathname) => path.resolve(SRC_DIR, pathname))
      .concat(
        path.relative(CWD, path.resolve(__dirname, '../../resolute-client.tsx'))
      )
  );

  const nodeModules = list.filter((dep) =>
    MATCHES_NODE_MODULE.test(dep.resolved)
  );

  rimrafSync(STATIC_PATHNAME);
  mkdirpSync(STATIC_PATHNAME);
  await cpy(PUBLIC_FILES_GLOB, STATIC_PATHNAME);
  await Promise.all(
    nodeModules.map(async (dep) => {
      const outPath = path.resolve(
        STATIC_PATHNAME,
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

      const code = compileBabel(content, dep.resolved, ['NODE_ENV'], true);

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

  compileTypeScript(
    clientFiles.map((pathname) => path.resolve(SRC_PATHNAME, pathname)),
    SRC_PATHNAME,
    STATIC_PATHNAME
  );
  const resoluteClientRoot = path.resolve(__dirname, '../../');
  compileTypeScript(
    [path.resolve(resoluteClientRoot, 'resolute-client.tsx')],
    resoluteClientRoot,
    STATIC_PATHNAME
  );
  compileTypeScript(
    [path.resolve(resoluteClientRoot, 'index.ts')],
    resoluteClientRoot,
    path.resolve(STATIC_PATHNAME, 'node-modules', '@blinkorb/resolute')
  );

  const expressServer = app.listen(process.env.PORT || 3000, async () => {
    const clientPromises = clientFiles.map(async (client) => {
      const pathname = path.join(SRC_PATHNAME, client);
      const clientModule = await getModule(pathname);
      const props = await getProps(clientModule, pathname);
      const element = await getModuleElement(clientModule, pathname, props);

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
        STATIC_PATHNAME,
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
      console.log(`Created ${path.relative(CWD, outFile)}`);

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
