import fs from 'node:fs';
import path from 'node:path';

import cpy from 'cpy';
import express from 'express';
import { glob } from 'glob';
import { mkdirpSync } from 'mkdirp';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Helmet } from 'react-helmet';
import { rimrafSync } from 'rimraf';

import { PORT } from '../../constants.js';
import type { RequestMethod } from '../../index.js';
import { UnknownObject } from '../../types.js';
import { getModuleElement } from '../../utils/component.js';
import { assertModule, getModule } from '../../utils/module.js';
import {
  CWD,
  OUT_PATHNAME,
  PUBLIC_FILES_GLOB,
  SRC_DIR,
  SRC_PATHNAME,
} from '../constants.js';

const MaybeHead = ({
  clientModule,
  client,
}: {
  clientModule: UnknownObject;
  client: string;
}) => {
  if (!('title' in clientModule)) {
    return <Helmet />;
  }

  const { title } = clientModule;

  if (!(typeof title === 'string' || typeof title === 'number')) {
    throw new Error(`Title must be a string or number in "${client}"`);
  }

  return (
    <Helmet>
      <title>{title}</title>
    </Helmet>
  );
};

const serveStatic = async () => {
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
    const serverModule: unknown = await import(path.join(SRC_PATHNAME, server));

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

  rimrafSync(OUT_PATHNAME);
  mkdirpSync(OUT_PATHNAME);
  cpy(PUBLIC_FILES_GLOB, OUT_PATHNAME);

  app.use(express.static(OUT_PATHNAME));

  const expressServer = app.listen(PORT, async () => {
    // eslint-disable-next-line no-console
    console.log(`Listening on http://localhost:${PORT}`);

    process.on('SIGINT', () => {
      expressServer.close();
    });

    const clientPromises = clientFiles.map(async (client) => {
      const pathname = path.join(SRC_PATHNAME, client);
      const clientModule = await getModule(pathname);
      const element = getModuleElement(clientModule, pathname);

      const staticMarkup = renderToStaticMarkup(
        <>
          <MaybeHead clientModule={clientModule} client={client} />
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
        OUT_PATHNAME,
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

      fs.writeFileSync(outFile, html, 'utf8');
    });

    await Promise.all(clientPromises);
  });
};

export default serveStatic;
