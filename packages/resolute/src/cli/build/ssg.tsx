import fs from 'node:fs';
import path from 'node:path';

import cpy from 'cpy';
import { glob } from 'glob';
import { mkdirpSync } from 'mkdirp';
import { rimrafSync } from 'rimraf';

import { MATCHES_TRAILING_SLASH } from '../../constants.js';
import {
  MATCHES_NODE_MODULE,
  MATCHES_RESOLUTE,
  MATCHES_SERVER,
  PUBLIC_FILES_GLOB,
  RESOLUTE_PATHNAME,
  SERVER_PATHNAME,
  SRC_PATHNAME,
  STATIC_PATHNAME,
} from '../constants.js';
import { compileBabel, compileTypeScript } from '../utils/compile.js';
import { getAllDependencies } from '../utils/deps.js';

const buildStatic = async () => {
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

  // Copy resolute files
  await cpy(
    path.resolve(RESOLUTE_PATHNAME, '**/*.js'),
    path.resolve(STATIC_PATHNAME, 'node-modules', '@blinkorb', 'resolute'),
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
      'node-modules/@blinkorb/resolute/**/*.{js,jsx,mjs,cjs}'
    )
  );

  // Get all non-resolute client dependencies
  const { list: clientDependencies, modules: clientModules } =
    await getAllDependencies(clientFiles);
  const nonResoluteClientDependencies = clientDependencies.filter(
    (dep) =>
      !MATCHES_RESOLUTE.test(dep.module) && !MATCHES_RESOLUTE.test(dep.resolved)
  );

  // Complain about server-side imports in client files
  clientModules.forEach((mod) => {
    mod.dependencies.forEach((dep) => {
      if (
        !MATCHES_NODE_MODULE.test(dep.resolved) &&
        MATCHES_SERVER.test(dep.module)
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
  const { list: resoluteDependencies } = await getAllDependencies(
    resoluteFiles
  );
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
  const clientLocalDependencyPaths = uniqueDependencies
    .filter((dep) => !MATCHES_NODE_MODULE.test(dep.resolved))
    .map((dep) => dep.resolved);

  // Filter only node modules
  const nodeModuleDependencyPaths = uniqueDependencies
    .filter((dep) => MATCHES_NODE_MODULE.test(dep.resolved))
    .map((dep) => dep.resolved);

  // Compile node modules with babel to handle env vars and dead code elimination
  await Promise.all(
    nodeModuleDependencyPaths.map(async (pathname) => {
      const outPath = path.resolve(
        STATIC_PATHNAME,
        pathname.replace(/^.*node_modules\//, 'node-modules/')
      );

      mkdirpSync(path.dirname(outPath));
      const content = fs.readFileSync(pathname, {
        encoding: 'utf8',
      });

      const code = compileBabel(content, pathname, ['NODE_ENV']);

      fs.writeFileSync(
        outPath,
        // Hack to fix react imports
        code.replace(
          /(import\s+[\w]+\s+from\s*["']\.\/cjs\/react\.(production|development)\.min\.js["'];)/,
          `$1export * from"./cjs/react.$2.min.js";`
        ),
        { encoding: 'utf8' }
      );
    })
  );

  // Compile client modules with babel to handle env vars and dead code elimination
  await Promise.all(
    [...clientFiles, ...clientLocalDependencyPaths].map(async (pathname) => {
      const outPath = path.resolve(
        STATIC_PATHNAME,
        path.relative(SERVER_PATHNAME, pathname)
      );

      mkdirpSync(path.dirname(outPath));
      const content = fs.readFileSync(pathname, {
        encoding: 'utf8',
      });

      const code = compileBabel(content, pathname, [
        'NODE_ENV',
        'PORT',
        'URL',
        'API_URL',
      ]);

      fs.writeFileSync(outPath, code, { encoding: 'utf8' });
    })
  );

  // Compile resolute modules in place with babel to handle env vars and dead code elimination
  await Promise.all(
    resoluteFiles.map(async (pathname) => {
      const outPath = pathname;

      mkdirpSync(path.dirname(outPath));
      const content = fs.readFileSync(pathname, {
        encoding: 'utf8',
      });

      const code = compileBabel(content, pathname, [
        'NODE_ENV',
        'PORT',
        'URL',
        'API_URL',
      ]);

      fs.writeFileSync(outPath, code, { encoding: 'utf8' });
    })
  );
};

export default buildStatic;
