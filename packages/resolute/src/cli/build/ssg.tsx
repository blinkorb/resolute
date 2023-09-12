import path from 'node:path';

import cpy from 'cpy';
import { rimrafSync } from 'rimraf';

import {
  OUT_PATHNAME,
  PUBLIC_FILES_GLOB,
  RESOLUTE_PATHNAME,
} from '../constants.js';

const buildStatic = async () => {
  rimrafSync(OUT_PATHNAME);
  await cpy(PUBLIC_FILES_GLOB, OUT_PATHNAME);
  await cpy(
    path.resolve(RESOLUTE_PATHNAME, '**/*.js'),
    path.resolve(OUT_PATHNAME, 'node-modules', '@blinkorb', 'resolute'),
    { filter: (file) => !file.path.includes('/cli/') }
  );
};

export default buildStatic;
