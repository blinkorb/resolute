import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import chokidar from 'chokidar';
import cpy from 'cpy';
import { IDependency, IModule } from 'dependency-cruiser';
import { glob } from 'glob';
import metadataParser from 'markdown-yaml-metadata-parser';
import { mkdirpSync } from 'mkdirp';
import React, { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { Helmet } from 'react-helmet';
import { createGenerateId, JssProvider, SheetsRegistry } from 'react-jss';
import ReactMarkdown from 'react-markdown';
import { rimrafSync } from 'rimraf';

import { SCOPED_CLIENT, SCOPED_NAME } from '../../constants.js';
import { Page } from '../../page.js';
import type {
  LayoutJSON,
  LocationInfo,
  PageDataJSON,
  PageMeta,
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
import {
  CWD,
  GLOB_JS_AND_MARKDOWN_EXTENSION,
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
  RESOLUTE_VERSION,
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

export class StaticFileHandler {
  private publicPathname: string;
  private sourcePathname: string;
  private serverPathname: string;
  private staticPathname: string;
  private resoluteSourcePathname: string;
  private watch: boolean;
  private clientFiles: string[] = [];
  private clientModules: IModule[] = [];
  private resoluteFiles: string[] = [];
  private resoluteModules: IModule[] = [];
  private clientLocalDependencies: IDependency[] = [];
  private nodeModuleDependencies: IDependency[] = [];
  private nodeModuleVersionMap: Record<string, string> = {};
  private settings: ResoluteSettings = {};
  private routeMapping: RouteMapping = {};

  public constructor(
    publicPathname: string,
    sourcePathname: string,
    serverPathname: string,
    staticPathname: string,
    resoluteSourcePathname: string,
    watch: boolean | undefined
  ) {
    this.publicPathname = publicPathname;
    this.sourcePathname = sourcePathname;
    this.serverPathname = serverPathname;
    this.staticPathname = staticPathname;
    this.resoluteSourcePathname = resoluteSourcePathname;
    this.watch = !!watch;
  }

  /** Files that will be used on the client (from server, including resolute) and related dependencies */
  public async loadClientFilesAndDependenciesFromServer() {
    this.clientFiles = glob.sync([
      path.resolve(
        this.serverPathname,
        `**/*.{page,client,layout}${GLOB_JS_EXTENSION}`
      ),
      path.resolve(
        this.serverPathname,
        `resolute.settings${GLOB_JS_EXTENSION}`
      ),
    ]);

    this.resoluteFiles = glob.sync(
      path.resolve(this.resoluteSourcePathname, `**/*${GLOB_JS_EXTENSION}`),
      { ignore: path.resolve(this.resoluteSourcePathname, 'cli/**') }
    );

    const { list: clientDependencies, modules: clientModules } =
      await getAllDependencies(this.clientFiles);

    // Complain about server-side imports in client files
    clientModules.forEach((mod) => {
      mod.dependencies.forEach((dep) => {
        if (
          !MATCHES_NODE_MODULE.test(dep.resolved) &&
          MATCHES_SERVER_STATIC_API.test(dep.resolved)
        ) {
          // eslint-disable-next-line no-console
          console.error(
            `Found a bad server-side import of "${dep.module}" in ${mod.source}.\nIf you require the types for an API use "typeof import('./path')"`
          );
          if (!this.watch) {
            return process.exit(1);
          }
        }
      });
    });

    this.clientModules = clientModules;

    const { list: resoluteDependencies, modules: resoluteModules } =
      await getAllDependencies(this.resoluteFiles);

    this.resoluteModules = resoluteModules;

    const uniqueDependencies = [
      ...clientDependencies,
      ...resoluteDependencies,
    ].filter(
      (dep, index, context) =>
        context.findIndex((d) => d.resolved === dep.resolved) === index
    );

    this.clientLocalDependencies = uniqueDependencies.filter(
      (dep) =>
        !MATCHES_NODE_MODULE.test(dep.resolved) &&
        !MATCHES_RESOLUTE.test(dep.resolved)
    );

    this.nodeModuleDependencies = uniqueDependencies.filter(
      (dep) =>
        MATCHES_NODE_MODULE.test(dep.resolved) ||
        MATCHES_RESOLUTE.test(dep.resolved)
    );

    this.nodeModuleVersionMap = getVersionMap(
      this.nodeModuleDependencies.filter((dep) =>
        MATCHES_NODE_MODULE.test(dep.resolved)
      )
    );
  }

  /** Clear server and static directories */
  public clearOutDirs(): void {
    rimrafSync(this.serverPathname);
    rimrafSync(this.staticPathname);
  }

  /** Copy public files into static directory */
  public async copyPublicFilesIntoStatic() {
    await cpy(path.resolve(this.publicPathname, '**/*'), this.staticPathname);
  }

  /** Copy markdown files into server directory */
  public async copyMarkdownFilesIntoServer() {
    await cpy(
      path.resolve(this.sourcePathname, `**/*${GLOB_MARKDOWN_EXTENSION}`),
      this.serverPathname
    );
  }

  /** Compile source TypeScript files into server directory */
  public compileTypeScriptSourceFilesIntoServer() {
    const sourceFiles = glob.sync(
      path.resolve(this.sourcePathname, `**/*${GLOB_SRC_EXTENSION}`)
    );

    compileTypeScript(sourceFiles, this.sourcePathname, this.serverPathname);
  }

  /** Loads resolute.settings.js from the server directory */
  public async loadResoluteSettingsFromServer() {
    try {
      this.settings =
        (
          await import(
            path.resolve(this.serverPathname, 'resolute.settings.js')
          )
        ).default || {};
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('Failed to load resolute.settings.js');
    }
  }

  public async compileNodeModulesIntoStatic() {
    await Promise.all(
      this.nodeModuleDependencies
        .filter((dep) => !MATCHES_RESOLUTE.test(dep.resolved))
        .map((dep) => dep.resolved)
        .map(async (pathname) => {
          const outPath = path.resolve(
            this.staticPathname,
            toStaticPath(pathname, this.nodeModuleVersionMap)
          );

          mkdirpSync(path.dirname(outPath));
          const content = fs.readFileSync(pathname, {
            encoding: 'utf8',
          });

          const code = compileBabel(content, pathname, ['NODE_ENV'], true, [
            ...this.clientModules,
            ...this.resoluteModules,
          ]);

          fs.writeFileSync(outPath, code, { encoding: 'utf8' });
        })
    );
  }

  public async compileClientFilesFromServerIntoStatic() {
    await Promise.all(
      [
        ...this.clientFiles,
        ...this.clientLocalDependencies.map((dep) => dep.resolved),
      ].map(async (pathname) => {
        const outPath = path.resolve(
          this.staticPathname,
          path.relative(this.serverPathname, pathname)
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
      })
    );
  }

  public async compileResoluteFilesInStaticInPlace() {
    await Promise.all(
      this.resoluteFiles.map(async (pathname) => {
        const outPath = path.resolve(
          this.staticPathname,
          'node-modules',
          `${SCOPED_NAME}@${RESOLUTE_VERSION}`,
          path.relative(this.resoluteSourcePathname, pathname)
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
  }

  public extractStaticFileSourceMaps() {
    const staticFiles = glob.sync(
      path.resolve(this.staticPathname, `**/*${GLOB_JS_EXTENSION}`)
    );

    staticFiles.forEach((pathname) => {
      extractSourceMap(pathname);
    });
  }

  public loadComponentRoutesAndLayoutsFromServer() {
    // Get page, client, static, server, and layout files
    const componentFiles = glob.sync([
      path.resolve(
        this.serverPathname,
        `**/*.{page,client,static,server,layout}${GLOB_JS_EXTENSION}`
      ),
      path.resolve(this.serverPathname, `**/*${GLOB_MARKDOWN_EXTENSION}`),
    ]);

    // Construct routes from component pathnames
    const componentRoutes = componentFiles.map((pathname) => ({
      pathname,
      route: pathnameToRoute(pathname, this.serverPathname),
    }));

    // Collect components related to specific routes
    const routeMapping = componentRoutes.reduce<RouteMappingWithLayoutInfo>(
      (acc, { pathname, route }) => {
        if (MATCHES_PAGE.test(pathname)) {
          if (acc[route]?.page) {
            // eslint-disable-next-line no-console
            console.error(`Encountered 2 pages for route "${route}"`);
            if (!this.watch) {
              return process.exit(1);
            }
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
            if (!this.watch) {
              return process.exit(1);
            }
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
            if (!this.watch) {
              return process.exit(1);
            }
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
            if (!this.watch) {
              return process.exit(1);
            }
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
        if (!this.watch) {
          return process.exit(1);
        }
      }
    });

    // Collect info about layouts
    const layouts = componentRoutes
      .filter(({ pathname }) => MATCHES_LAYOUT.test(pathname))
      .map(({ pathname, route }) => ({
        pathname,
        route,
        depth: getDepth(pathname, this.serverPathname),
      }));

    // Add layouts to route mapping
    this.routeMapping = Object.fromEntries(
      Object.entries(routeMapping).map(([route, info]) => {
        const newInfo = layouts.reduce<RouteInfoWithLayoutInfo>(
          (acc, layout) => {
            const pathname =
              info.client || info.static || info.page || info.markdown!;

            if (
              isPartialRouteMatch(route, layout.route) &&
              isPartialPathMatch(
                path.relative(this.serverPathname, pathname),
                path.relative(this.serverPathname, layout.pathname)
              )
            ) {
              return {
                ...acc,
                layouts: [...acc.layouts, layout],
              };
            }

            return acc;
          },
          info
        );

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
  }

  private async getElement(route: string, info: RouteInfo) {
    const href = `${(process.env.URL || '').replace(/\/?$/, '')}${route}`;

    if (info.markdown) {
      const src = fs.readFileSync(info.markdown, { encoding: 'utf8' });
      const { content, metadata } = metadataParser(src);

      const element = (
        <ReactMarkdown {...this.settings.markdown}>{content}</ReactMarkdown>
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
  }

  private async renderToHTML(
    elementWithLayouts: ReactElement,
    meta: PageMeta,
    layoutsJSON: readonly LayoutJSON[],
    location: LocationInfo,
    clientPathname: string | undefined
  ) {
    const pageFiles = [
      require.resolve(SCOPED_CLIENT),
      ...(clientPathname
        ? [clientPathname, ...layoutsJSON.map((layout) => layout.pathname)]
        : []),
    ];

    const { list: pageDependencies } = await getAllDependencies(pageFiles);

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
          settings={this.settings}
          preload={preload}
        >
          {elementWithLayouts}
        </Page>
      </JssProvider>
    )}</div>`;

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

    const resoluteClientHref = `/node-modules/${SCOPED_NAME}@${RESOLUTE_VERSION}/client.js`;

    // Construct import map
    const importMap = `<script type="importmap">${JSON.stringify({
      imports: this.nodeModuleDependencies
        .filter((dep) => !MATCHES_LOCAL.test(dep.module))
        .reduce(
          (acc, dep) => {
            return {
              ...acc,
              [dep.module]: `/${toStaticPath(
                dep.resolved,
                this.nodeModuleVersionMap
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
          this.nodeModuleVersionMap
        )}" />`;
      })
      .join('');

    const head = `${headHelmet}${importMap}${modulePreload}${headStyles}`;

    const html = `<!DOCTYPE html><html><head>${head}${resoluteClient}</head><body data-render-state="rendering">${body}</body></html>\n`;

    return {
      head,
      body,
      html,
    };
  }

  public async generateStaticFiles() {
    await Promise.all(
      Object.entries(this.routeMapping).map(async ([route, info]) => {
        const clientPathname = info.client || info.page;
        const { element, pageProps, meta, location, href, pathname } =
          await this.getElement(route, info);

        // Wrap page with layouts
        const { element: elementWithLayouts, layoutsJSON } =
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

        const { head, body, html } = await this.renderToHTML(
          elementWithLayouts,
          meta,
          layoutsJSON,
          location,
          clientPathname
        );

        const outFileHTML = path.resolve(
          this.staticPathname,
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
                    .relative(this.serverPathname, clientPathname)
                    .replace(/^(\.?\/)?/, '/'),
                  layouts: layoutsJSON.map((layout) => ({
                    ...layout,
                    pathname: `/${path.relative(
                      this.serverPathname,
                      layout.pathname
                    )}`,
                  })),
                },
                static: {
                  head,
                  meta,
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
  }

  public watchMarkdownIntoServer() {
    const markdownWatcher = chokidar.watch(`**/*${GLOB_MARKDOWN_EXTENSION}`, {
      ignoreInitial: true,
      cwd: this.sourcePathname,
    });

    markdownWatcher
      .on('add', (pathname) => {
        try {
          fs.cpSync(
            path.resolve(this.sourcePathname, pathname),
            path.resolve(this.serverPathname, pathname)
          );
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error(error);
        }
      })
      .on('change', (pathname) => {
        try {
          fs.cpSync(
            path.resolve(this.sourcePathname, pathname),
            path.resolve(this.serverPathname, pathname)
          );
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error(error);
        }
      })
      .on('unlink', (pathname) => {
        try {
          fs.unlinkSync(path.resolve(this.serverPathname, pathname));
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error(error);
        }
      });
  }

  public watchPublicIntoServer() {
    const publicWatcher = chokidar.watch('**/*', {
      ignoreInitial: true,
      cwd: this.publicPathname,
    });

    publicWatcher
      .on('add', (pathname) => {
        try {
          fs.cpSync(
            path.resolve(this.publicPathname, pathname),
            path.resolve(this.staticPathname, pathname)
          );
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error(error);
        }
      })
      .on('change', (pathname) => {
        try {
          fs.cpSync(
            path.resolve(this.publicPathname, pathname),
            path.resolve(this.staticPathname, pathname)
          );
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error(error);
        }
      })
      .on('unlink', (pathname) => {
        try {
          fs.unlinkSync(path.resolve(this.staticPathname, pathname));
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error(error);
        }
      });
  }

  public watchTypeScriptSourceFilesIntoServer() {
    watchTypeScript(this.sourcePathname, this.serverPathname);
  }

  public watchServerFilesIntoStatic() {
    const serverWatcher = chokidar.watch(
      `**/*${GLOB_JS_AND_MARKDOWN_EXTENSION}`,
      {
        ignoreInitial: true,
        cwd: this.serverPathname,
      }
    );

    serverWatcher
      .on('add', (pathname) => {
        console.log('add', pathname);

        /*
        if markdown rebuild page and serve new static
        if javascript
          if resolute.settings rebuild all pages and serve static and client
          if page rebuild page and serve static and new client
          if static rebuild page and serve static
            if has page/client serve client
          if layout rebuild related pages and serve static and client (as relevant)
          if client serve new client

          rebuild all pages that depend on this file
          if settings depend on this file rebuild all pages
        */
      })
      .on('change', (pathname) => {
        console.log('change', pathname);
      })
      .on('unlink', (pathname) => {
        console.log('delete', pathname);
      });
  }
}
