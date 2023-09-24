import fs from 'node:fs';
import path from 'node:path';

import cpy from 'cpy';
import express from 'express';
import { glob } from 'glob';
import { mkdirpSync } from 'mkdirp';
import React, { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { Helmet } from 'react-helmet';
import { rimrafSync } from 'rimraf';

import { MATCHES_TRAILING_SLASH } from '../../constants.js';
import { RequestMethod } from '../../index.js';
import Page from '../../page.js';
import { LayoutJSON, PageDataJSON } from '../../types.js';
import {
  getInjectedProps,
  getModuleElement,
  getProps,
} from '../../utils/component.js';
import { getPageMeta } from '../../utils/meta.js';
import { getModule } from '../../utils/module.js';
import { toAPIPath } from '../../utils/paths.js';
import {
  MATCHES_CLIENT,
  MATCHES_LAYOUT,
  MATCHES_LOCAL,
  MATCHES_NODE_MODULE,
  MATCHES_PAGE,
  MATCHES_RESOLUTE,
  MATCHES_SERVER_STATIC_API,
  MATCHES_STATIC,
  PUBLIC_FILES_GLOB,
  RESOLUTE_PATHNAME,
  RESOLUTE_VERSION,
  SERVER_PATHNAME,
  SRC_PATHNAME,
  STATIC_PATHNAME,
} from '../constants.js';
import { compileBabel, compileTypeScript } from '../utils/compile.js';
import { getAllDependencies, getVersionMap } from '../utils/deps.js';
import {
  fromServerPathToRelativeTSX,
  isPartialRouteMatch,
  pathnameToRoute,
  toStaticNodeModulePath,
} from '../utils/paths.js';

interface LayoutInfo {
  pathname: string;
  route: string;
  depth: number;
}

interface RouteInfoWithLayoutInfo {
  page?: string;
  client?: string;
  static?: string;
  layouts: readonly LayoutInfo[];
}

interface RouteInfo extends Omit<RouteInfoWithLayoutInfo, 'layouts'> {
  layouts: readonly string[];
}

type RouteMappingWithLayoutInfo = Record<string, RouteInfoWithLayoutInfo>;
type RouteMapping = Record<string, RouteInfo>;

const buildStatic = async () => {
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

  // Clear out dir
  rimrafSync(STATIC_PATHNAME);
  rimrafSync(SERVER_PATHNAME);

  // Copy public files
  await cpy(PUBLIC_FILES_GLOB, STATIC_PATHNAME);

  // Copy CSS files
  await cpy(path.resolve(SRC_PATHNAME, '**/*.{css,scss}'), SERVER_PATHNAME);

  // Copy resolute files
  await cpy(
    path.resolve(RESOLUTE_PATHNAME, '**/*.js'),
    path.resolve(
      STATIC_PATHNAME,
      'node-modules',
      '@blinkorb',
      `resolute@${RESOLUTE_VERSION}`
    ),
    { filter: (file) => !file.path.includes('/cli/') }
  );

  // Get src files
  const srcFiles = glob.sync(
    path.resolve(SRC_PATHNAME, '**/*.{ts,tsx,js,jsx,mjs,cjs}')
  );

  // Compile src files
  compileTypeScript(srcFiles, SRC_PATHNAME, SERVER_PATHNAME);

  // All out files
  const clientFiles = glob.sync(
    path.resolve(SERVER_PATHNAME, '**/*.{page,client,layout}.{js,jsx,mjs,cjs}')
  );

  const resoluteFiles = glob.sync(
    path.resolve(
      STATIC_PATHNAME,
      'node-modules/@blinkorb/resolute@*/**/*.{js,jsx,mjs,cjs}'
    )
  );

  // Get all non-resolute client dependencies
  const { list: clientDependencies, modules: pageModules } =
    await getAllDependencies(clientFiles);
  const nonResoluteClientDependencies = clientDependencies.filter(
    (dep) =>
      !MATCHES_RESOLUTE.test(dep.module) && !MATCHES_RESOLUTE.test(dep.resolved)
  );

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
  const { list: resoluteDependencies } =
    await getAllDependencies(resoluteFiles);
  const nonResoluteResoluteDependencies = resoluteDependencies.filter(
    (dep) =>
      !MATCHES_RESOLUTE.test(dep.module) && !MATCHES_RESOLUTE.test(dep.resolved)
  );

  // De-duplicate dependencies
  const uniqueDependencies = [
    ...nonResoluteClientDependencies,
    ...nonResoluteResoluteDependencies,
  ].filter(
    (dep, index, context) =>
      context.findIndex((d) => d.resolved === dep.resolved) === index
  );

  // Filter out node modules
  const clientLocalDependencies = uniqueDependencies.filter(
    (dep) =>
      !MATCHES_NODE_MODULE.test(dep.resolved) && !/\.s?css$/.test(dep.resolved)
  );

  // Filter only node modules
  const nodeModuleDependencies = uniqueDependencies.filter((dep) =>
    MATCHES_NODE_MODULE.test(dep.resolved)
  );

  const nodeModulesVersionMap = getVersionMap(nodeModuleDependencies);

  // Compile node modules with babel to handle env vars and dead code elimination
  await Promise.all(
    nodeModuleDependencies
      .map((dep) => dep.resolved)
      .map(async (pathname) => {
        const outPath = path.resolve(
          STATIC_PATHNAME,
          toStaticNodeModulePath(pathname, nodeModulesVersionMap)
        );

        mkdirpSync(path.dirname(outPath));
        const content = fs.readFileSync(pathname, {
          encoding: 'utf8',
        });

        const code = compileBabel(content, pathname, ['NODE_ENV'], {
          envAndDeadCode: true,
          commonjs: true,
          css: false,
        });

        fs.writeFileSync(
          outPath,
          code
            .replace(
              // Hack to fix react imports
              /(import\s+[\w]+\s+from\s*["']\.\/cjs\/react\.(production|development)\.min\.js["'];)/,
              `$1export * from"./cjs/react.$2.min.js";`
            )
            .replace(
              // Hack to fix relative imports that don't include a file extension
              /from\s*["']([^"']*?)["'];/,
              (match, importPath: string) => {
                if (
                  MATCHES_LOCAL.test(importPath) &&
                  importPath.substring(importPath.length - 3) !== '.js'
                ) {
                  return `from"${importPath}.js";`;
                }

                return match;
              }
            ),
          { encoding: 'utf8' }
        );
      })
  );

  // Compile client modules in place with babel to handle CSS modules
  await Promise.all(
    [...clientFiles, ...clientLocalDependencies.map((dep) => dep.resolved)].map(
      async (pathname) => {
        const content = fs.readFileSync(pathname, {
          encoding: 'utf8',
        });

        const code = compileBabel(
          content,
          pathname,
          ['NODE_ENV', 'PORT', 'URL', 'API_URL'],
          {
            envAndDeadCode: false,
            commonjs: false,
            css: true,
          }
        );

        fs.writeFileSync(pathname, code, { encoding: 'utf8' });
      }
    )
  );

  console.log('css modules transformed');

  // Compile client modules with babel to handle env vars and dead code elimination
  await Promise.all(
    [...clientFiles, ...clientLocalDependencies.map((dep) => dep.resolved)].map(
      async (pathname) => {
        console.log(pathname);

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
          ['NODE_ENV', 'PORT', 'URL', 'API_URL'],
          {
            envAndDeadCode: true,
            commonjs: false,
            css: false,
          }
        );

        fs.writeFileSync(outPath, code, { encoding: 'utf8' });
      }
    )
  );

  console.log('babel compiled');

  // Compile resolute modules in place with babel to handle env vars and dead code elimination
  await Promise.all(
    resoluteFiles.map(async (pathname) => {
      const outPath = pathname;

      mkdirpSync(path.dirname(outPath));
      const content = fs.readFileSync(pathname, {
        encoding: 'utf8',
      });

      const code = compileBabel(
        content,
        pathname,
        ['NODE_ENV', 'PORT', 'URL', 'API_URL'],
        {
          envAndDeadCode: true,
          commonjs: false,
          css: false,
        }
      );

      fs.writeFileSync(outPath, code, { encoding: 'utf8' });
    })
  );

  // Get page, client, static, server, and layout files
  const componentFiles = glob.sync(
    path.resolve(SERVER_PATHNAME, '**/*.{page,client,static,server,layout}.js')
  );

  // Construct routes from component pathnames
  const componentRoutes = componentFiles.map((pathname) => ({
    pathname,
    route: pathnameToRoute(pathname),
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

  await Promise.all(
    glob
      .sync(path.resolve(SERVER_PATHNAME, '**/*.api.js'))
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
        const href = `${(process.env.URL || '').replace(/\/?$/, '')}${route}`;
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
                  pathname: path
                    .relative(SERVER_PATHNAME, layout)
                    .replace(/^(\.?\/)?/, '/'),
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

        // Render page
        const body = renderToString(
          <Page
            location={withInjectedProps.location}
            router={router}
            meta={withInjectedProps.meta}
          >
            {withLayouts}
          </Page>
        );

        const helmet = Helmet.renderStatic();

        // Collect head info from helmet
        const head = [
          helmet.title.toString(),
          helmet.meta.toString(),
          helmet.link.toString(),
          helmet.style.toString(),
          helmet.script.toString(),
        ]
          .filter((str) => str)
          .join('\n');

        // Construct import map
        const importMap = JSON.stringify({
          imports: nodeModuleDependencies
            .filter((dep) => !MATCHES_LOCAL.test(dep.module))
            .reduce(
              (acc, dep) => {
                return {
                  ...acc,
                  [dep.module]: `/${toStaticNodeModulePath(
                    dep.resolved,
                    nodeModulesVersionMap
                  )}`,
                };
              },
              {
                '@blinkorb/resolute': `/node-modules/@blinkorb/resolute@${RESOLUTE_VERSION}/index.js`,
              }
            ),
        });

        const html = `<!DOCTYPE html><html><head>${head}</head><script type="importmap">${importMap}</script><script defer type="module" src="/node-modules/@blinkorb/resolute@${RESOLUTE_VERSION}/client.js"></script><body>${body}</body></html>\n`;

        const outFileHTML = path.resolve(
          STATIC_PATHNAME,
          route.replace(/^\/?/, ''),
          'index.html'
        );
        const outDir = path.dirname(outFileHTML);
        const outFileJSON = path.resolve(outDir, 'resolute.json');

        const json = (
          info.client || info.page
            ? {
                client: {
                  pathname: path
                    .relative(SERVER_PATHNAME, info.client || info.page!)
                    .replace(/^(\.?\/)?/, '/'),
                  layouts: layoutsJSON,
                },
                static: {
                  meta: getPageMeta(
                    pageModule,
                    fromServerPathToRelativeTSX(pathname)
                  ),
                  props: pageProps,
                },
              }
            : {
                static: { head, body },
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
      `Built in ${((Date.now() - startTime) / 1000).toFixed(2)}s\nClosing...`
    );
    expressServer.close();
  });
};

export default buildStatic;
