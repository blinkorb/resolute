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

  // Copy public files
  await cpy(PUBLIC_FILES_GLOB, STATIC_PATHNAME);

  // Copy resolute files
  await cpy(
    path.resolve(RESOLUTE_PATHNAME, '**/*.js'),
    path.resolve(STATIC_PATHNAME, 'node-modules', '@blinkorb', 'resolute'),
    { filter: (file) => !file.path.includes('/cli/') }
  );

  // Get client files
  const clientFiles = glob.sync(
    path.resolve(
      SRC_PATHNAME,
      '**/*.{page,client,layout}.{ts,tsx,js,jsx,mjs,cjs}'
    )
  );

  // Compile client files
  compileTypeScript(clientFiles, SRC_PATHNAME, STATIC_PATHNAME);

  // Get bad server output files
  const badServerOutputFiles = glob.sync(
    path.resolve(
      STATIC_PATHNAME,
      '**/*.{static,server,api}.{ts,tsx,js,jsx,mjs,cjs}'
    )
  );

  // Remove bad server output files
  rimrafSync(badServerOutputFiles);

  // All out files
  const outFiles = glob.sync(
    path.resolve(STATIC_PATHNAME, '**/*.{js,jsx,mjs,cjs}')
  );

  // Get all non-resolute dependencies
  const { list, modules } = await getAllDependencies(outFiles);
  const allDependencies = list.filter(
    (dep) =>
      !MATCHES_RESOLUTE.test(dep.module) && !MATCHES_RESOLUTE.test(dep.resolved)
  );

  // Filter out node modules
  const localDependencies = allDependencies.filter(
    (dep) => !MATCHES_NODE_MODULE.test(dep.resolved)
  );

  // Complain about imported server-side modules
  localDependencies.forEach((dep) => {
    if (MATCHES_SERVER.test(dep.module)) {
      const module = modules.find((mod) =>
        mod.dependencies.find((d) => d.module === dep.module)
      );
      // eslint-disable-next-line no-console
      console.error(
        `Found a bad server-side import of "${dep.module}" in ${module?.source}.\nIf you require the types for an API use "typeof import('./path')"`
      );
      return process.exit(1);
    }
  });

  // Filter only node modules
  const nodeModules = allDependencies.filter((dep) =>
    MATCHES_NODE_MODULE.test(dep.resolved)
  );

  // Compile node modules with babel to handle env vars and dead code elimination
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

      const babelResult = compileBabel(content, dep.resolved, ['NODE_ENV']);

      const { code } = babelResult;

      if (!code) {
        throw new Error(`No babel code for "${dep.resolved}"`);
      }

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
};

export default buildStatic;
