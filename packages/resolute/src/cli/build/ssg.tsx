import { execSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import http2 from 'node:http2';
import https from 'node:https';
import path from 'node:path';

import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { glob } from 'glob';
import { Hono } from 'hono';
import { WebSocketServer } from 'ws';

import {
  DEV_SERVER_PATHNAME,
  DEV_SERVER_SOCKET_PORT,
} from '../../constants.js';
import { RequestMethod } from '../../index.js';
import { getModule } from '../../utils/module.js';
import { toAPIPath } from '../../utils/paths.js';
import {
  CWD,
  GLOB_JS_EXTENSION,
  PUBLIC_PATHNAME,
  RESOLUTE_SRC_PATHNAME,
  SERVER_PATHNAME,
  SRC_PATHNAME,
  STATIC_PATHNAME,
} from '../constants.js';
import { EnvHandler } from './env-handler.js';
import { StaticFileHandler } from './static-file-handler.js';

export const buildStatic = async (watch?: boolean, serveHttps?: boolean) => {
  // eslint-disable-next-line no-console
  console.log('Building...');

  const startTime = Date.now();

  const envHandler = new EnvHandler(watch, serveHttps);

  envHandler.setupMainEnv();

  const staticFileHandler = new StaticFileHandler(
    PUBLIC_PATHNAME,
    SRC_PATHNAME,
    SERVER_PATHNAME,
    STATIC_PATHNAME,
    RESOLUTE_SRC_PATHNAME,
    watch
  );

  await staticFileHandler.clearOutDirs();
  await staticFileHandler.copyPublicFilesIntoStatic();
  await staticFileHandler.copyMarkdownFilesIntoServer();
  await staticFileHandler.compileTypeScriptSourceFilesIntoServer();
  await staticFileHandler.loadResoluteSettingsFromServer();
  await staticFileHandler.loadClientFilesAndDependenciesFromServer();
  await staticFileHandler.compileNodeModulesIntoStatic();
  await staticFileHandler.compileClientFilesFromServerIntoStatic();
  await staticFileHandler.compileResoluteFilesInStaticInPlace();
  await staticFileHandler.extractStaticFileSourceMaps();
  await staticFileHandler.loadComponentRoutesAndLayoutsFromServer();

  const app = new Hono();

  app.use(
    '/*',
    serveStatic({
      root: path.relative(CWD, STATIC_PATHNAME),
    })
  );

  app.get('/*', async (context, next) => {
    if (context.req.header('accept')?.includes('text/html')) {
      const notFoundPathname = path.resolve(STATIC_PATHNAME, '404/index.html');
      if (fs.existsSync(notFoundPathname)) {
        return context.html(fs.readFileSync(notFoundPathname).toString(), 404);
      }

      return context.text('Not found', 404);
    }

    return next();
  });

  // Setup API endpoints
  await Promise.all(
    glob
      .sync(path.resolve(SERVER_PATHNAME, `**/*.api${GLOB_JS_EXTENSION}`))
      .map(async (pathname) => {
        const serverModule = await getModule(pathname);

        Object.entries(serverModule).forEach(([fn, callback]) => {
          const match = /^(get|put|post|patch|delete|options)/.exec(fn);

          if (match && typeof callback === 'function') {
            const [, methodName] = match;

            const resolvedPathname = `/api/${toAPIPath(
              path.relative(SERVER_PATHNAME, pathname),
              fn
            )}`;

            app[methodName as RequestMethod](
              resolvedPathname,
              async (context) => {
                const data = await callback();

                return context.json(data);
              }
            );
          }
        });
      })
  );

  envHandler.setupBuildEnv();

  // eslint-disable-next-line no-console
  console.log('Starting build server...');

  await new Promise((resolve) => {
    const server = serve(
      {
        fetch: app.fetch,
        port: envHandler.buildPort,
        hostname: envHandler.buildHostname,
      },
      async () => {
        await staticFileHandler.generateStaticFiles();

        // eslint-disable-next-line no-console
        console.log(
          `Built in ${((Date.now() - startTime) / 1000).toFixed(2)}s`
        );
        // eslint-disable-next-line no-console
        console.log('Closing build server...');
        resolve(server.close());
      }
    );
  });

  if (watch) {
    if (
      serveHttps &&
      (!fs.existsSync('key.pem') || !fs.existsSync('cert.pem'))
    ) {
      execSync(
        'openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -sha256 -days 3650 -nodes -subj "/C=XX/ST=StateName/L=CityName/O=CompanyName/OU=CompanySectionName/CN=CommonNameOrHostname"'
      );
    }

    envHandler.setupMainEnv();

    const webSocketServerServer = serveHttps
      ? https.createServer({
          key: fs.readFileSync('key.pem', 'utf8'),
          cert: fs.readFileSync('cert.pem', 'utf8'),
        })
      : http.createServer();

    const webSocketServer = new WebSocketServer({
      server: webSocketServerServer,
      path: DEV_SERVER_PATHNAME,
    });

    webSocketServerServer.listen(DEV_SERVER_SOCKET_PORT, envHandler.hostname);

    webSocketServer.on('connection', (socket) => {
      // eslint-disable-next-line no-console
      console.log('Dev server connected');

      socket.send("These aren't the sockets you're looking for. 👋");

      socket.on('disconnect', () => {
        // eslint-disable-next-line no-console
        console.log('Dev server disconnected');
      });
    });

    await staticFileHandler.watchTypeScriptSourceFilesIntoServer();
    await staticFileHandler.watchMarkdownIntoServer();
    await staticFileHandler.watchPublicIntoServer();
    await staticFileHandler.watchServerFilesIntoStatic();

    const logServerRunning = () => {
      // eslint-disable-next-line no-console
      console.log(
        `Dev server running at ${envHandler.url} (port ${envHandler.port})`
      );
    };

    if (serveHttps) {
      serve(
        {
          fetch: app.fetch,
          port: envHandler.port,
          hostname: envHandler.hostname,
          createServer: http2.createSecureServer,
          serverOptions: {
            key: fs.readFileSync('key.pem', 'utf8'),
            cert: fs.readFileSync('cert.pem', 'utf8'),
          },
        },
        logServerRunning
      );
    } else {
      serve(
        {
          fetch: app.fetch,
          port: envHandler.port,
          hostname: envHandler.hostname,
          createServer: http.createServer,
        },
        logServerRunning
      );
    }
  }
};
