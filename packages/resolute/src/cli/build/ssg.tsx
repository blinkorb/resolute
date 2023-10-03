import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import cpy from 'cpy';
import { config as dotenvConfig } from 'dotenv';
import express from 'express';
import { glob } from 'glob';
import metadataParser from 'markdown-yaml-metadata-parser';
import { mkdirpSync } from 'mkdirp';
import React, { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { Helmet } from 'react-helmet';
import { createGenerateId, JssProvider, SheetsRegistry } from 'react-jss';
import ReactMarkdown from 'react-markdown';
import { rimrafSync } from 'rimraf';
import webpack from 'webpack';

import {
  MATCHES_JS_EXTENSION,
  MATCHES_TRAILING_SLASH,
} from '../../constants.js';
import { RequestMethod } from '../../index.js';
import Page from '../../page.js';
import { LayoutJSON, PageDataJSON, ResoluteSettings } from '../../types.js';
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
  BUILD_PATHNAME,
  GLOB_JS_EXTENSION,
  GLOB_MARKDOWN_EXTENSION,
  GLOB_PUBLIC_FILES,
  GLOB_SRC_EXTENSION,
  MATCHES_CLIENT,
  MATCHES_HASH_JS,
  MATCHES_LAYOUT,
  MATCHES_MARKDOWN_EXTENSION,
  MATCHES_NODE_MODULE,
  MATCHES_PAGE,
  MATCHES_SERVER_STATIC_API,
  MATCHES_STATIC,
  RESOLUTE_SRC_PATHNAME,
  SRC_PATHNAME,
  STATIC_PATHNAME,
} from '../constants.js';
import { compileTypeScript } from '../utils/compile.js';
import { getAllDependencies } from '../utils/deps.js';
import {
  fromCompiledPathToRelativeTSX,
  isPartialRouteMatch,
  pathnameToRoute,
} from '../utils/paths.js';

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
    fromCompiledPathToRelativeTSX(pathname),
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

const getBundledPathname = (
  relativePathname: string,
  relativePathnames: readonly string[]
) => {
  const matchingFile = relativePathnames.find(
    (p) => p.replace(MATCHES_HASH_JS, '.js') === relativePathname
  );

  if (!matchingFile) {
    throw new Error(`Could not find hashed bundle for ${relativePathname}`);
  }

  return `/${matchingFile}`;
};

const buildStatic = async (watch?: boolean) => {
  // eslint-disable-next-line no-console
  console.log('Building...');

  const startTime = Date.now();
  // Set environment variables
  process.env.NODE_ENV = 'production';
  process.env.PORT = process.env.PORT || '3000';
  process.env.URL = (
    process.env.URL || `http://localhost:${process.env.PORT}`
  ).replace(MATCHES_TRAILING_SLASH, '');
  process.env.API_URL = process.env.API_URL || `${process.env.URL}/api/`;

  // eslint-disable-next-line no-console
  console.log('Clearing directories...');
  // Clear out dir
  rimrafSync(BUILD_PATHNAME);
  rimrafSync(STATIC_PATHNAME);

  // eslint-disable-next-line no-console
  console.log('Copying public files...');
  // Copy public files
  await cpy(GLOB_PUBLIC_FILES, STATIC_PATHNAME);

  // eslint-disable-next-line no-console
  console.log('Copying markdown files...');
  await cpy(
    path.resolve(SRC_PATHNAME, `**/*${GLOB_MARKDOWN_EXTENSION}`),
    path.resolve(BUILD_PATHNAME, 'compiled')
  );

  // Get src files
  const srcFiles = glob.sync(
    path.resolve(SRC_PATHNAME, `**/*${GLOB_SRC_EXTENSION}`)
  );

  // eslint-disable-next-line no-console
  console.log('Compiling typescript...');
  // Compile src files
  compileTypeScript(
    srcFiles,
    SRC_PATHNAME,
    path.resolve(BUILD_PATHNAME, 'compiled')
  );

  // eslint-disable-next-line no-console
  console.log('Copying resolute files...');
  await cpy(
    path.resolve(RESOLUTE_SRC_PATHNAME, `**/*${GLOB_JS_EXTENSION}`),
    path.resolve(BUILD_PATHNAME, 'compiled', 'resolute'),
    { filter: (file) => !file.path.includes('/cli/') }
  );

  // All out files
  const clientFiles = glob.sync([
    path.resolve(
      BUILD_PATHNAME,
      'compiled',
      `**/*.{page,client,layout}${GLOB_JS_EXTENSION}`
    ),
    path.resolve(
      BUILD_PATHNAME,
      'compiled',
      `resolute.settings${GLOB_JS_EXTENSION}`
    ),
  ]);

  const resoluteClientPathname = path.resolve(
    BUILD_PATHNAME,
    'compiled',
    'resolute',
    'client.js'
  );

  // eslint-disable-next-line no-console
  console.log('Bundling files...');
  const relativeBundlePaths = await new Promise<readonly string[]>(
    (resolve) => {
      webpack(
        {
          entry: {
            ...Object.fromEntries(
              [resoluteClientPathname, ...clientFiles].map((pathname) => [
                path
                  .relative(path.resolve(BUILD_PATHNAME, 'compiled'), pathname)
                  .replace(MATCHES_JS_EXTENSION, ''),
                pathname,
              ])
            ),
          },
          devtool: false,
          module: {
            rules: [
              {
                test: /\.js$/,
                enforce: 'pre',
                use: [require.resolve('source-map-loader')],
              },
            ],
          },
          plugins: [
            new webpack.SourceMapDevToolPlugin({
              filename: '[file].map',
              noSources: false,
              sourceRoot: path.resolve(BUILD_PATHNAME, 'compiled'),
            }),
          ],
          output: {
            path: path.resolve(BUILD_PATHNAME, 'bundled'),
            filename: '[name].[contenthash].js',
            module: true,
          },
          optimization: {
            minimize: true,
            splitChunks: {
              chunks: 'all',
              filename: 'chunk.[contenthash].js',
            },
          },
          experiments: {
            outputModule: true,
          },
        },
        (error, stats) => {
          if (error) {
            // eslint-disable-next-line no-console
            console.error(error);
            return process.exit(1);
          }

          if (!stats) {
            // eslint-disable-next-line no-console
            console.error('Failed to get bundle stats');
            return process.exit(1);
          }

          // eslint-disable-next-line no-console
          console.log(
            `Bundled code in ${(
              (stats.endTime - stats.startTime) /
              1000
            ).toFixed(2)}s`
          );

          resolve(
            [...stats.compilation.emittedAssets.values()].filter((asset) =>
              asset.endsWith('.js')
            )
          );
        }
      );
    }
  );

  await cpy(path.resolve(BUILD_PATHNAME, 'bundled', `**/*`), STATIC_PATHNAME);

  const resoluteClientPath = relativeBundlePaths.find(
    (pathname) =>
      pathname.replace(MATCHES_HASH_JS, '.js') === 'resolute/client.js'
  );

  if (!resoluteClientPath) {
    // eslint-disable-next-line no-console
    console.error('Failed to find resolute client bundle');
    return process.exit(1);
  }

  // Load settings
  try {
    settings =
      (
        await import(
          path.resolve(BUILD_PATHNAME, 'compiled', 'resolute.settings.js')
        )
      ).default || {};
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Failed to load resolute.settings.js');
  }

  // Get all non-resolute client dependencies
  const { modules: pageModules } = await getAllDependencies(clientFiles);

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

  // eslint-disable-next-line no-console
  console.log('Collecting routes...');
  // Get page, client, static, server, and layout files
  const componentFiles = glob.sync([
    path.resolve(
      BUILD_PATHNAME,
      'compiled',
      `**/*.{page,client,static,server,layout}${GLOB_JS_EXTENSION}`
    ),
    path.resolve(BUILD_PATHNAME, 'compiled', `**/*${GLOB_MARKDOWN_EXTENSION}`),
  ]);

  // Construct routes from component pathnames
  const componentRoutes = componentFiles.map((pathname) => ({
    pathname,
    route: pathnameToRoute(pathname, path.resolve(BUILD_PATHNAME, 'compiled')),
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
      depth: pathname.split('/').length,
    }));

  // Add layouts to route mapping
  const routeMappingWithLayouts = Object.fromEntries(
    Object.entries(routeMapping).map(([route, info]) => {
      const newInfo = layouts.reduce<RouteInfoWithLayoutInfo>((acc, layout) => {
        if (isPartialRouteMatch(route, layout.route)) {
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

  const app = express();

  app.use(express.static(STATIC_PATHNAME));

  app.use('*', (req, res, next) => {
    if (req.headers.accept?.includes('text/html')) {
      return res.sendFile(path.resolve(STATIC_PATHNAME, '404/index.html'));
    }

    return next();
  });

  // Setup API endpoints
  await Promise.all(
    glob
      .sync(
        path.resolve(BUILD_PATHNAME, 'compiled', `**/*.api${GLOB_JS_EXTENSION}`)
      )
      .map(async (pathname) => {
        const serverModule = await getModule(pathname);

        Object.entries(serverModule).forEach(([fn, callback]) => {
          const match = /^(get|put|post|patch|delete|options)/.exec(fn);

          if (match && typeof callback === 'function') {
            const [, methodName] = match;

            const resolvedPathname = `/api/${toAPIPath(
              path.relative(path.resolve(BUILD_PATHNAME, 'compiled'), pathname),
              fn
            )}`;

            app[methodName as RequestMethod](
              resolvedPathname,
              async (req, res) => {
                const data = await callback(req);

                res.json(data);
              }
            );
          }
        });
      })
  );

  const expressServer = app.listen(process.env.PORT, async () => {
    await Promise.all(
      Object.entries(routeMappingWithLayouts).map(async ([route, info]) => {
        const clientComp = info.client || info.page;
        const { element, pageProps, meta, location, href, pathname } =
          await getElement(route, info);

        // Wrap page with layouts
        const { element: withLayouts, layoutsJSON } = await info.layouts.reduce<
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
              fromCompiledPathToRelativeTSX(layout),
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
                  pathname: path.relative(
                    path.resolve(BUILD_PATHNAME, 'compiled'),
                    layout
                  ),
                  props: layoutProps,
                },
              ],
            };
          },
          Promise.resolve({ element, layoutsJSON: [] })
        );

        const throwNavigationError = () => {
          throw new Error('You cannot navigate in an ssg/ssr context');
        };

        const router = {
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
        const body = renderToString(
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
        );

        const helmet = Helmet.renderStatic();
        const headStyles = `<style type="text/css" data-jss>${sheets.toString({
          format: false,
        })}</style>`;

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

        const resoluteClient = `<script defer type="module" src="/${resoluteClientPath}"></script>`;
        const modulePreload = clientComp
          ? [...info.layouts, clientComp]
              .map((comp) => {
                const relative = path.relative(
                  path.resolve(BUILD_PATHNAME, 'compiled'),
                  comp
                );

                return getBundledPathname(relative, relativeBundlePaths);
              })
              .map((relativePathname) => {
                return `<link rel="modulepreload" href="${relativePathname}">`;
              })
              .join('')
          : '';

        const staticHead = `${headHelmet}${modulePreload}${headStyles}`;

        const html = `<!DOCTYPE html><html><head>${staticHead}${resoluteClient}</head><body>${body}</body></html>\n`;

        const outFileHTML = path.resolve(
          STATIC_PATHNAME,
          route.replace(/^\/?/, ''),
          'index.html'
        );
        const outDir = path.dirname(outFileHTML);
        const outFileJSON = path.resolve(outDir, 'resolute.json');

        const json = (
          clientComp
            ? {
                client: {
                  pathname: getBundledPathname(
                    path.relative(
                      path.resolve(BUILD_PATHNAME, 'compiled'),
                      clientComp
                    ),
                    relativeBundlePaths
                  ),
                  layouts: layoutsJSON.map((layout) => ({
                    pathname: getBundledPathname(
                      layout.pathname,
                      relativeBundlePaths
                    ),
                    props: layout.props,
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
    console.log(`Built in ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
    if (!watch) {
      // eslint-disable-next-line no-console
      console.log('Closing...');
      expressServer.close();
      return;
    }

    // eslint-disable-next-line no-console
    console.log(`Serving at http://localhost:${process.env.PORT}`);
  });
};

export default buildStatic;
