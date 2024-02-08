import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { Worker } from 'node:worker_threads';

import chokidar from 'chokidar';
import cpy from 'cpy';
import { IDependency, IModule } from 'dependency-cruiser';
import { glob } from 'glob';
import { mkdirpSync } from 'mkdirp';
import { rimrafSync } from 'rimraf';
import type {
  EmitAndSemanticDiagnosticsBuilderProgram,
  WatchOfConfigFile,
} from 'typescript';

import { SCOPED_NAME } from '../../constants.js';
import {
  CWD,
  GLOB_JS_AND_MARKDOWN_EXTENSION,
  GLOB_JS_EXTENSION,
  GLOB_MARKDOWN_EXTENSION,
  GLOB_SRC_EXTENSION,
  MATCHES_CLIENT,
  MATCHES_LAYOUT,
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
import { createDebounced, createDebouncedByKey } from '../utils/debounce.js';
import { getAllDependencies, getVersionMap } from '../utils/deps.js';
import {
  getDepth,
  isPartialPathMatch,
  isPartialRouteMatch,
  pathnameToRoute,
  toStaticPath,
} from '../utils/paths.js';
import { extractSourceMap } from '../utils/source-maps.js';
import type { EnvHandler } from './env-handler.js';
import type {
  RouteInfo,
  RouteInfoWithLayoutInfo,
  RouteMapping,
  RouteMappingWithLayoutInfo,
  WorkerData,
} from './types.js';

const require = createRequire(import.meta.url);

export class StaticFileHandler {
  private publicPathname: string;
  private sourcePathname: string;
  private serverPathname: string;
  private staticPathname: string;
  private resoluteSourcePathname: string;
  private watch: boolean;
  private envHandler: EnvHandler;
  private clientFiles: string[] = [];
  private clientModules: IModule[] = [];
  private resoluteFiles: string[] = [];
  private resoluteModules: IModule[] = [];
  private clientLocalDependencies: IDependency[] = [];
  private nodeModuleDependencies: IDependency[] = [];
  private nodeModuleVersionMap: Record<string, string> = {};
  private routeMapping: RouteMapping = {};
  private typeScriptProgram:
    | WatchOfConfigFile<EmitAndSemanticDiagnosticsBuilderProgram>
    | undefined;

  public constructor(
    publicPathname: string,
    sourcePathname: string,
    serverPathname: string,
    staticPathname: string,
    resoluteSourcePathname: string,
    watch: boolean | undefined,
    envHandler: EnvHandler
  ) {
    this.publicPathname = publicPathname;
    this.sourcePathname = sourcePathname;
    this.serverPathname = serverPathname;
    this.staticPathname = staticPathname;
    this.resoluteSourcePathname = resoluteSourcePathname;
    this.watch = !!watch;
    this.envHandler = envHandler;
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

    compileTypeScript(
      sourceFiles,
      this.sourcePathname,
      this.serverPathname,
      this.watch
    );
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
            'HOSTNAME',
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
          ['NODE_ENV', 'HOSTNAME', 'PORT', 'URL', 'API_URL'],
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

  public async generateFilesForRoute(route: string, info: RouteInfo) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(require.resolve('./generate-worker.js'), {
        workerData: {
          route,
          info,
          env: Object.entries(process.env).reduce((acc, [key, value]) => {
            if (typeof value === 'string') {
              return {
                ...acc,
                [key]: value,
              };
            }

            return acc;
          }, {}),
          publicPathname: this.publicPathname,
          sourcePathname: this.sourcePathname,
          serverPathname: this.serverPathname,
          staticPathname: this.staticPathname,
          resoluteSourcePathname: this.resoluteSourcePathname,
          watch: this.watch,
          envHandler: this.envHandler,
          clientFiles: this.clientFiles,
          clientModules: this.clientModules,
          resoluteFiles: this.resoluteFiles,
          resoluteModules: this.resoluteModules,
          clientLocalDependencies: this.clientLocalDependencies,
          nodeModuleDependencies: this.nodeModuleDependencies,
          nodeModuleVersionMap: this.nodeModuleVersionMap,
          routeMapping: this.routeMapping,
        } satisfies WorkerData,
      });

      worker.on('exit', resolve);
      worker.on('error', reject);
    });
  }

  public generateFilesForRouteDebounced = createDebouncedByKey(
    async (route: string, info: RouteInfo) => {
      // eslint-disable-next-line no-console
      console.log(`Rebuilding route "${route}"...`);
      const startTime = Date.now();

      await this.generateFilesForRoute(route, info);

      // eslint-disable-next-line no-console
      console.log(
        `Rebuilt route "${route}" in ${(
          (Date.now() - startTime) /
          1000
        ).toFixed(2)}s`
      );
    },
    (route) => route,
    100
  );

  public async generateStaticFiles() {
    await Promise.all(
      Object.entries(this.routeMapping).map(async ([route, info]) =>
        this.generateFilesForRoute(route, info)
      )
    );
  }

  public rebuildAllStaticFilesDebounced = createDebounced(async () => {
    const startTime = Date.now();

    this.envHandler.setupMainEnv();
    await this.loadClientFilesAndDependenciesFromServer();
    await this.compileNodeModulesIntoStatic();
    await this.compileClientFilesFromServerIntoStatic();
    await this.compileResoluteFilesInStaticInPlace();
    await this.extractStaticFileSourceMaps();
    await this.loadComponentRoutesAndLayoutsFromServer();
    await this.generateStaticFiles();

    // eslint-disable-next-line no-console
    console.log(`Built in ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
  }, 100);

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
    this.typeScriptProgram = watchTypeScript(
      this.sourcePathname,
      this.serverPathname
    );
  }

  public restartWatchTypeScriptSourceFilesIntoServer() {
    this.typeScriptProgram?.close();
    this.watchTypeScriptSourceFilesIntoServer();
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
      .on('add', async (pathname) => {
        console.log('add', pathname);

        if (pathname === 'resolute.settings.js') {
          // eslint-disable-next-line no-console
          console.log('resolute.settings changed. Rebuilding static files...');

          await this.rebuildAllStaticFilesDebounced();
        }

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
      .on('change', async (pathname) => {
        console.log('change', pathname);

        if (pathname === 'resolute.settings.js') {
          // eslint-disable-next-line no-console
          console.log(`${pathname} changed. Rebuilding static files...`);

          await this.rebuildAllStaticFilesDebounced();
        } else if (MATCHES_MARKDOWN_EXTENSION.test(pathname)) {
          // eslint-disable-next-line no-console
          console.log(`${pathname} changed`);

          await this.loadClientFilesAndDependenciesFromServer();
          await this.loadComponentRoutesAndLayoutsFromServer();

          const absolutePathname = path.resolve(this.serverPathname, pathname);
          const route = pathnameToRoute(absolutePathname, this.serverPathname);

          const routeInfo = this.routeMapping[route];

          if (routeInfo) {
            await this.generateFilesForRouteDebounced(route, routeInfo);
          }
        } else {
          const startTime = Date.now();

          await this.loadClientFilesAndDependenciesFromServer();
          await this.loadComponentRoutesAndLayoutsFromServer();

          console.log(
            `Loaded dependencies in ${((Date.now() - startTime) / 1000).toFixed(
              2
            )}s`
          );
        }
      })
      .on('unlink', async (pathname) => {
        console.log('delete', pathname);

        if (pathname === 'resolute.settings.js') {
          // eslint-disable-next-line no-console
          console.log('resolute.settings changed. Rebuilding static files...');

          await this.rebuildAllStaticFilesDebounced();
        }
      });
  }

  public watchDotenvAndBuildAllIntoStatic() {
    const dotenvWatcher = chokidar.watch('.env', {
      ignoreInitial: true,
      cwd: CWD,
    });

    const onChange = async () => {
      // eslint-disable-next-line no-console
      console.log('.env changed. Rebuilding static files...');

      await this.rebuildAllStaticFilesDebounced();
    };

    dotenvWatcher
      .on('add', onChange)
      .on('change', onChange)
      .on('unlink', onChange);
  }

  public watchTsconfigCompileTypeScriptIntoServer() {
    const dotenvWatcher = chokidar.watch('tsconfig.resolute.json', {
      ignoreInitial: true,
      cwd: CWD,
    });

    const onChange = async () => {
      // eslint-disable-next-line no-console
      console.log(
        'tsconfig.resolute.json changed. Rebuilding TypeScript files...'
      );

      await this.compileTypeScriptSourceFilesIntoServer();
      await this.restartWatchTypeScriptSourceFilesIntoServer();
    };

    dotenvWatcher
      .on('add', onChange)
      .on('change', onChange)
      .on('unlink', onChange);
  }
}
