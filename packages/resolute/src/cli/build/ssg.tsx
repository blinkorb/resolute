import { execSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import http2 from 'node:http2';
import https from 'node:https';
import { createRequire } from 'node:module';
import path from 'node:path';

import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import chokidar from 'chokidar';
import cpy from 'cpy';
import { config as dotenvConfig } from 'dotenv';
import { glob } from 'glob';
import { Hono } from 'hono';
import metadataParser from 'markdown-yaml-metadata-parser';
import { mkdirpSync } from 'mkdirp';
import React, { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { Helmet } from 'react-helmet';
import { createGenerateId, JssProvider, SheetsRegistry } from 'react-jss';
import ReactMarkdown from 'react-markdown';
import { rimrafSync } from 'rimraf';
import { WebSocketServer } from 'ws';

import {
  MATCHES_TRAILING_SLASH,
  SCOPED_CLIENT,
  SCOPED_NAME,
  WEB_SOCKET_PORT,
} from '../../constants.js';
import { RequestMethod } from '../../index.js';
import Page from '../../page.js';
import {
  LayoutJSON,
  PageDataJSON,
  ResoluteSettings,
  Router,
} from '../../types.js';
import {
  getInjectedProps,
  getModuleElement,
  getProps,
} from '../../utils/component.js';
import { getLocationInfo } from '../../utils/location.js';
import { getPageMeta } from '../../utils/meta.js';
import { getModule } from '../../utils/module.js';
import { toAPIPath } from '../../utils/paths.js';
import {
  CWD,
  GLOB_JS_EXTENSION,
  GLOB_MARKDOWN_EXTENSION,
  GLOB_SRC_EXTENSION,
  MATCHES_CLIENT,
  MATCHES_LAYOUT,
  MATCHES_LOCAL,
  MATCHES_MARKDOWN_EXTENSION,
  MATCHES_NODE_MODULE,
  MATCHES_PAGE,
  MATCHES_RESOLUTE,
  MATCHES_SERVER_STATIC_API,
  MATCHES_STATIC,
  PUBLIC_FILES_GLOB,
  RESOLUTE_SRC_PATHNAME,
  RESOLUTE_VERSION,
  SERVER_PATHNAME,
  SRC_PATHNAME,
  STATIC_PATHNAME,
} from '../constants.js';
import {
  compileBabel,
  compileTypeScript,
  watchTypeScript,
} from '../utils/compile.js';
import { getAllDependencies, getVersionMap } from '../utils/deps.js';
import {
  fromServerPathToRelativeTSX,
  getDepth,
  isPartialPathMatch,
  isPartialRouteMatch,
  pathnameToRoute,
  toStaticPath,
} from '../utils/paths.js';
import { extractSourceMap } from '../utils/source-maps.js';

const require = createRequire(import.meta.url);

dotenvConfig();

let settings: ResoluteSettings = {};

interface LayoutInfo {
  pathname: string;
  route: string;
  depth: number;
}

interface RouteInfoWithLayoutInfo {
  page?: string;
  client?: string;
  static?: string;
  markdown?: string;
  layouts: readonly LayoutInfo[];
}

interface RouteInfo extends Omit<RouteInfoWithLayoutInfo, 'layouts'> {
  layouts: readonly string[];
}

type RouteMappingWithLayoutInfo = Record<string, RouteInfoWithLayoutInfo>;
type RouteMapping = Record<string, RouteInfo>;

const getElement = async (route: string, info: RouteInfo) => {
  const href = `${(process.env.URL || '').replace(/\/?$/, '')}${route}`;

  if (info.markdown) {
    const src = fs.readFileSync(info.markdown, { encoding: 'utf8' });
    const { content, metadata } = metadataParser(src);

    const element = (
      <ReactMarkdown {...settings.markdown}>{content}</ReactMarkdown>
    );

    return {
      element,
      pageProps: {},
      meta: getPageMeta(metadata, info.markdown),
      location: getLocationInfo(href),
      href,
      pathname: info.markdown,
    };
  }

  const pathname = info.static || info.page!;
  const pageModule = await getModule(pathname);
  const pageProps = await getProps(pageModule, pathname);
  const withInjectedProps = getInjectedProps(
    pageModule,
    pathname,
    href,
    pageProps,
    undefined,
    'static'
  );

  const element = await getModuleElement(
    pageModule,
    fromServerPathToRelativeTSX(pathname),
    withInjectedProps
  );

  return {
    element,
    pageProps,
    meta: withInjectedProps.meta,
    location: withInjectedProps.location,
    href,
    pathname,
  };
};

const buildStatic = async (watch?: boolean, serveHttps?: boolean) => {
  // eslint-disable-next-line no-console
  console.log('Building...');

  const httpsS = serveHttps ? 's' : '';
  const startTime = Date.now();

  process.env.NODE_ENV = watch ? 'development' : 'production';
  // Set environment variables
  const PORT = process.env.PORT || '3000';
  const HOSTNAME = process.env.HOSTNAME || '0.0.0.0';
  const URL = (
    process.env.URL || `http${httpsS}://${HOSTNAME}:${PORT}`
  ).replace(MATCHES_TRAILING_SLASH, '');
  const API_URL = process.env.API_URL || `${URL}/api/`;

  const BUILD_PORT = process.env.BUILD_PORT || '4000';
  const BUILD_HOSTNAME = process.env.BUILD_HOSTNAME || 'localhost';
  const BUILD_URL = (
    process.env.BUILD_URL || `http://${BUILD_HOSTNAME}:${BUILD_PORT}`
  ).replace(MATCHES_TRAILING_SLASH, '');
  const BUILD_API_URL = process.env.BUILD_API_URL || `${BUILD_URL}/api/`;

  process.env.HOSTNAME = HOSTNAME;
  process.env.PORT = PORT;
  process.env.URL = URL;
  process.env.API_URL = API_URL;

  // Clear out dir
  rimrafSync(STATIC_PATHNAME);
  rimrafSync(SERVER_PATHNAME);

  // Copy public files
  await cpy(PUBLIC_FILES_GLOB, STATIC_PATHNAME);

  // Copy markdown files
  await cpy(
    path.resolve(SRC_PATHNAME, `**/*${GLOB_MARKDOWN_EXTENSION}`),
    SERVER_PATHNAME
  );

  // Get src files
  const srcFiles = glob.sync(
    path.resolve(SRC_PATHNAME, `**/*${GLOB_SRC_EXTENSION}`)
  );

  // Compile src files
  compileTypeScript(srcFiles, SRC_PATHNAME, SERVER_PATHNAME);

  // All out files
  const clientFiles = glob.sync([
    path.resolve(
      SERVER_PATHNAME,
      `**/*.{page,client,layout}${GLOB_JS_EXTENSION}`
    ),
    path.resolve(SERVER_PATHNAME, `resolute.settings${GLOB_JS_EXTENSION}`),
  ]);

  // Load settings
  try {
    settings =
      (await import(path.resolve(SERVER_PATHNAME, 'resolute.settings.js')))
        .default || {};
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Failed to load resolute.settings.js');
  }

  const resoluteClientFiles = glob.sync(
    path.resolve(RESOLUTE_SRC_PATHNAME, `**/*${GLOB_JS_EXTENSION}`),
    { ignore: path.resolve(RESOLUTE_SRC_PATHNAME, 'cli/**') }
  );

  // Get all non-resolute client dependencies
  const { list: clientDependencies, modules: pageModules } =
    await getAllDependencies(clientFiles);

  // Complain about server-side imports in client files
  pageModules.forEach((mod) => {
    mod.dependencies.forEach((dep) => {
      if (
        !MATCHES_NODE_MODULE.test(dep.resolved) &&
        MATCHES_SERVER_STATIC_API.test(dep.resolved)
      ) {
        // eslint-disable-next-line no-console
        console.error(
          `Found a bad server-side import of "${dep.module}" in ${mod.source}.\nIf you require the types for an API use "typeof import('./path')"`
        );
        return process.exit(1);
      }
    });
  });

  // Get all non-resolute resolute dependencies
  const { list: resoluteClientDependencies, modules: resoluteModules } =
    await getAllDependencies(resoluteClientFiles);

  // De-duplicate dependencies
  const uniqueDependencies = [
    ...clientDependencies,
    ...resoluteClientDependencies,
  ].filter(
    (dep, index, context) =>
      context.findIndex((d) => d.resolved === dep.resolved) === index
  );

  // Filter out node modules
  const clientLocalDependencies = uniqueDependencies.filter(
    (dep) =>
      !MATCHES_NODE_MODULE.test(dep.resolved) &&
      !MATCHES_RESOLUTE.test(dep.resolved)
  );

  // Filter only node modules
  const nodeModuleDependencies = uniqueDependencies.filter(
    (dep) =>
      MATCHES_NODE_MODULE.test(dep.resolved) ||
      MATCHES_RESOLUTE.test(dep.resolved)
  );

  const nodeModulesVersionMap = getVersionMap(
    nodeModuleDependencies.filter((dep) =>
      MATCHES_NODE_MODULE.test(dep.resolved)
    )
  );

  // Compile node modules with babel to handle env vars and dead code elimination
  await Promise.all(
    nodeModuleDependencies
      .filter((dep) => !MATCHES_RESOLUTE.test(dep.resolved))
      .map((dep) => dep.resolved)
      .map(async (pathname) => {
        const outPath = path.resolve(
          STATIC_PATHNAME,
          toStaticPath(pathname, nodeModulesVersionMap)
        );

        mkdirpSync(path.dirname(outPath));
        const content = fs.readFileSync(pathname, {
          encoding: 'utf8',
        });

        const code = compileBabel(content, pathname, ['NODE_ENV'], true, [
          ...pageModules,
          ...resoluteModules,
        ]);

        fs.writeFileSync(outPath, code, { encoding: 'utf8' });
      })
  );

  // Compile client modules with babel to handle env vars and dead code elimination
  await Promise.all(
    [...clientFiles, ...clientLocalDependencies.map((dep) => dep.resolved)].map(
      async (pathname) => {
        const outPath = path.resolve(
          STATIC_PATHNAME,
          path.relative(SERVER_PATHNAME, pathname)
        );

        mkdirpSync(path.dirname(outPath));
        const content = fs.readFileSync(pathname, {
          encoding: 'utf8',
        });

        const code = compileBabel(
          content,
          pathname,
          [
            'NODE_ENV',
            'PORT',
            'URL',
            'API_URL',
            ...Object.keys(process.env).filter((key) =>
              key.startsWith('CLIENT_')
            ),
          ],
          false,
          []
        );

        fs.writeFileSync(outPath, code, { encoding: 'utf8' });
      }
    )
  );

  // Compile resolute modules in place with babel to handle env vars and dead code elimination
  await Promise.all(
    resoluteClientFiles.map(async (pathname) => {
      const outPath = path.resolve(
        STATIC_PATHNAME,
        'node-modules',
        `${SCOPED_NAME}@${RESOLUTE_VERSION}`,
        path.relative(RESOLUTE_SRC_PATHNAME, pathname)
      );

      mkdirpSync(path.dirname(outPath));
      const content = fs.readFileSync(pathname, {
        encoding: 'utf8',
      });

      const code = compileBabel(
        content,
        pathname,
        ['NODE_ENV', 'PORT', 'URL', 'API_URL'],
        false,
        []
      );

      fs.writeFileSync(outPath, code, { encoding: 'utf8' });
    })
  );

  const staticFiles = glob.sync(
    path.resolve(STATIC_PATHNAME, `**/*${GLOB_JS_EXTENSION}`)
  );

  staticFiles.forEach((pathname) => {
    extractSourceMap(pathname);
  });

  // Get page, client, static, server, and layout files
  const componentFiles = glob.sync([
    path.resolve(
      SERVER_PATHNAME,
      `**/*.{page,client,static,server,layout}${GLOB_JS_EXTENSION}`
    ),
    path.resolve(SERVER_PATHNAME, `**/*${GLOB_MARKDOWN_EXTENSION}`),
  ]);

  // Construct routes from component pathnames
  const componentRoutes = componentFiles.map((pathname) => ({
    pathname,
    route: pathnameToRoute(pathname, SERVER_PATHNAME),
  }));

  // Collect components related to specific routes
  const routeMapping = componentRoutes.reduce<RouteMappingWithLayoutInfo>(
    (acc, { pathname, route }) => {
      if (MATCHES_PAGE.test(pathname)) {
        if (acc[route]?.page) {
          // eslint-disable-next-line no-console
          console.error(`Encountered 2 pages for route "${route}"`);
          return process.exit(1);
        }

        return {
          ...acc,
          [route]: {
            ...acc[route],
            page: pathname,
            layouts: [],
          },
        };
      }

      if (MATCHES_CLIENT.test(pathname)) {
        if (acc[route]?.client) {
          // eslint-disable-next-line no-console
          console.error(`Encountered 2 client pages for route "${route}"`);
          return process.exit(1);
        }

        return {
          ...acc,
          [route]: {
            ...acc[route],
            client: pathname,
            layouts: [],
          },
        };
      }

      if (MATCHES_STATIC.test(pathname)) {
        if (acc[route]?.static) {
          // eslint-disable-next-line no-console
          console.error(`Encountered 2 static pages for route "${route}"`);
          return process.exit(1);
        }

        return {
          ...acc,
          [route]: {
            ...acc[route],
            static: pathname,
            layouts: [],
          },
        };
      }

      if (MATCHES_MARKDOWN_EXTENSION.test(pathname)) {
        if (acc[route]) {
          // eslint-disable-next-line no-console
          console.error(
            `Encountered a another page that clashes with a markdown page for route "${route}"`
          );
          return process.exit(1);
        }

        return {
          ...acc,
          [route]: {
            ...acc[route],
            markdown: pathname,
            layouts: [],
          },
        };
      }

      return acc;
    },
    {}
  );

  // Complain about client side components without a server side component
  Object.entries(routeMapping).forEach(([route, info]) => {
    if (info.client && !info.static) {
      // eslint-disable-next-line no-console
      console.error(
        `Found client module for route "${route}" but no static module`
      );
      return process.exit(1);
    }
  });

  // Collect info about layouts
  const layouts = componentRoutes
    .filter(({ pathname }) => MATCHES_LAYOUT.test(pathname))
    .map(({ pathname, route }) => ({
      pathname,
      route,
      depth: getDepth(pathname, SERVER_PATHNAME),
    }));

  // Add layouts to route mapping
  const routeMappingWithLayouts = Object.fromEntries(
    Object.entries(routeMapping).map(([route, info]) => {
      const newInfo = layouts.reduce<RouteInfoWithLayoutInfo>((acc, layout) => {
        const pathname =
          info.client || info.static || info.page || info.markdown!;

        if (
          isPartialRouteMatch(route, layout.route) &&
          isPartialPathMatch(
            path.relative(SERVER_PATHNAME, pathname),
            path.relative(SERVER_PATHNAME, layout.pathname)
          )
        ) {
          return {
            ...acc,
            layouts: [...acc.layouts, layout],
          };
        }

        return acc;
      }, info);

      return [
        route,
        {
          ...newInfo,
          layouts: newInfo.layouts
            .filter((layout, index, context) => {
              const layoutMatchingDepth = context.find(
                (l, i) => l.depth === layout.depth && i !== index
              );

              return (
                // Ensure we only have one layout at each depth
                !layoutMatchingDepth ||
                // Taking the longest match if there are multiple
                layout.route.length > layoutMatchingDepth.route.length
              );
            })
            .sort((a, b) => b.depth - a.depth)
            .map(({ pathname }) => pathname),
        },
      ];
    })
  ) satisfies RouteMapping;

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

  process.env.HOSTNAME = BUILD_HOSTNAME;
  process.env.PORT = BUILD_PORT;
  process.env.URL = BUILD_URL;
  process.env.API_URL = BUILD_API_URL;

  // eslint-disable-next-line no-console
  console.log('Starting build server...');

  await new Promise((resolve) => {
    const server = serve(
      {
        fetch: app.fetch,
        port: parseInt(process.env.PORT!, 10),
        hostname: BUILD_HOSTNAME,
      },
      async () => {
        await Promise.all(
          Object.entries(routeMappingWithLayouts).map(async ([route, info]) => {
            const clientPathname = info.client || info.page;
            const { element, pageProps, meta, location, href, pathname } =
              await getElement(route, info);

            // Wrap page with layouts
            const { element: withLayouts, layoutsJSON } =
              await info.layouts.reduce<
                Promise<{
                  element: ReactElement;
                  layoutsJSON: readonly LayoutJSON[];
                }>
              >(
                async (accPromise, layout) => {
                  const acc = await accPromise;
                  const layoutModule = await getModule(layout);
                  const layoutProps = await getProps(layoutModule, layout);
                  const layoutElement = await getModuleElement(
                    layoutModule,
                    fromServerPathToRelativeTSX(layout),
                    getInjectedProps(
                      layoutModule,
                      pathname,
                      href,
                      layoutProps,
                      acc.element,
                      'static'
                    )
                  );

                  return {
                    element: layoutElement,
                    layoutsJSON: [
                      ...acc.layoutsJSON,
                      {
                        pathname: layout,
                        props: layoutProps,
                      },
                    ],
                  };
                },
                Promise.resolve({ element, layoutsJSON: [] })
              );

            const pageFiles = [
              require.resolve(SCOPED_CLIENT),
              ...(clientPathname
                ? [
                    clientPathname,
                    ...layoutsJSON.map((layout) => layout.pathname),
                  ]
                : []),
            ];

            const { list: pageDependencies } =
              await getAllDependencies(pageFiles);

            const uniquePageDependencies = [
              {
                // Manually included as this is a dynamic import
                module: '/resolute.settings.js',
                resolved: 'server/resolute.settings.js',
              },
              // Include client file and layouts if it can be hydrated
              ...(clientPathname
                ? [
                    {
                      module: `./${path.basename(clientPathname)}`,
                      resolved: path.relative(CWD, clientPathname),
                    },
                    ...layoutsJSON.map((layout) => ({
                      module: `./${path.basename(layout.pathname)}`,
                      resolved: path.relative(CWD, layout.pathname),
                    })),
                  ]
                : []),
              ...pageDependencies,
            ].filter(
              (dep, index, context) =>
                context.findIndex((d) => d.resolved === dep.resolved) === index
            );

            const throwNavigationError = () => {
              throw new Error('You cannot navigate in an ssg/ssr context');
            };

            const router: Router = {
              navigate: throwNavigationError,
              go: throwNavigationError,
              back: throwNavigationError,
              forward: throwNavigationError,
            };

            const preload = () => {
              throw new Error('You cannot preload in an ssg/ssr context');
            };

            const sheets = new SheetsRegistry();
            const generateId = createGenerateId();

            // Render page
            const body = `<div data-resolute-root="true" id="resolute-root">${renderToString(
              <JssProvider registry={sheets} generateId={generateId}>
                <Page
                  location={location}
                  router={router}
                  meta={meta}
                  settings={settings}
                  preload={preload}
                >
                  {withLayouts}
                </Page>
              </JssProvider>
            )}</div>`;

            const helmet = Helmet.renderStatic();
            const headStyles = `<style type="text/css" data-jss>${sheets.toString(
              {
                format: false,
              }
            )}</style>`;

            // Collect head info from helmet
            const headHelmet = [
              helmet.title.toString(),
              helmet.meta.toString(),
              helmet.link.toString(),
              helmet.style.toString(),
              helmet.script.toString(),
            ]
              .filter((str) => str)
              .join('\n');

            const resoluteClientHref = `/node-modules/${SCOPED_NAME}@${RESOLUTE_VERSION}/client.js`;

            // Construct import map
            const importMap = `<script type="importmap">${JSON.stringify({
              imports: nodeModuleDependencies
                .filter((dep) => !MATCHES_LOCAL.test(dep.module))
                .reduce(
                  (acc, dep) => {
                    return {
                      ...acc,
                      [dep.module]: `/${toStaticPath(
                        dep.resolved,
                        nodeModulesVersionMap
                      )}`,
                    };
                  },
                  {
                    [SCOPED_CLIENT]: resoluteClientHref,
                  }
                ),
            })}</script>`;

            const resoluteClient = `<script defer type="module" src="${resoluteClientHref}"></script>`;
            const modulePreload = uniquePageDependencies
              .map((dep) => {
                return `<link rel="modulepreload" href="/${toStaticPath(
                  dep.resolved,
                  nodeModulesVersionMap
                )}" />`;
              })
              .join('');

            const staticHead = `${headHelmet}${importMap}${modulePreload}${headStyles}`;

            const html = `<!DOCTYPE html><html><head>${staticHead}${resoluteClient}</head><body data-render-state="rendering">${body}</body></html>\n`;

            const outFileHTML = path.resolve(
              STATIC_PATHNAME,
              route.replace(/^\/?/, ''),
              'index.html'
            );
            const outDir = path.dirname(outFileHTML);
            const outFileJSON = path.resolve(outDir, 'resolute.json');

            const json = (
              clientPathname
                ? {
                    client: {
                      pathname: path
                        .relative(SERVER_PATHNAME, clientPathname)
                        .replace(/^(\.?\/)?/, '/'),
                      layouts: layoutsJSON.map((layout) => ({
                        ...layout,
                        pathname: `/${path.relative(
                          SERVER_PATHNAME,
                          layout.pathname
                        )}`,
                      })),
                    },
                    static: {
                      head: staticHead,
                      meta,
                      props: pageProps,
                    },
                  }
                : {
                    static: { head: staticHead, body },
                  }
            ) satisfies PageDataJSON;

            // Output json and html for page
            mkdirpSync(outDir);
            fs.writeFileSync(outFileHTML, html, { encoding: 'utf8' });
            fs.writeFileSync(outFileJSON, JSON.stringify(json), {
              encoding: 'utf8',
            });
          })
        );

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

    process.env.HOSTNAME = HOSTNAME;
    process.env.PORT = PORT;
    process.env.URL = URL;
    process.env.API_URL = API_URL;

    const webSocketServerServer = serveHttps
      ? https.createServer({
          key: fs.readFileSync('key.pem', 'utf8'),
          cert: fs.readFileSync('cert.pem', 'utf8'),
        })
      : http.createServer();

    const webSocketServer = new WebSocketServer({
      server: webSocketServerServer,
      path: '/resolute-dev-server',
    });

    webSocketServerServer.listen(WEB_SOCKET_PORT, HOSTNAME);

    webSocketServer.on('connection', (socket) => {
      // eslint-disable-next-line no-console
      console.log('Dev server connected');

      socket.on('disconnect', () => {
        // eslint-disable-next-line no-console
        console.log('Dev server disconnected');
      });
    });

    watchTypeScript(SRC_PATHNAME, SERVER_PATHNAME);

    const markdownWatcher = chokidar.watch(`**/*${GLOB_MARKDOWN_EXTENSION}`, {
      ignoreInitial: true,
      cwd: SRC_PATHNAME,
    });

    markdownWatcher
      .on('add', (pathname) => {
        try {
          fs.cpSync(
            path.resolve(SRC_PATHNAME, pathname),
            path.resolve(SERVER_PATHNAME, pathname)
          );
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error(error);
        }
      })
      .on('change', (pathname) => {
        try {
          fs.cpSync(
            path.resolve(SRC_PATHNAME, pathname),
            path.resolve(SERVER_PATHNAME, pathname)
          );
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error(error);
        }
      })
      .on('unlink', (pathname) => {
        try {
          fs.unlinkSync(path.resolve(SERVER_PATHNAME, pathname));
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error(error);
        }
      });

    const logServerRunning = () => {
      // eslint-disable-next-line no-console
      console.log(`Dev server running at ${URL} (port ${PORT})`);
    };

    if (serveHttps) {
      serve(
        {
          fetch: app.fetch,
          port: parseInt(process.env.PORT, 10),
          hostname: HOSTNAME,
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
          port: parseInt(process.env.PORT, 10),
          hostname: HOSTNAME,
          createServer: http.createServer,
        },
        logServerRunning
      );
    }
  }
};

export default buildStatic;
