import path from 'node:path';

import cpy from 'cpy';
import { rimrafSync } from 'rimraf';

import {
  MATCHES_TRAILING_SLASH,
  OUT_PATHNAME,
  PUBLIC_FILES_GLOB,
  RESOLUTE_PATHNAME,
} from '../constants.js';

const buildStatic = async () => {
  process.env.NODE_ENV = 'production';
  process.env.PORT = process.env.PORT || '3000';
  process.env.URL = (
    process.env.URL || `http://localhost:${process.env.PORT}`
  ).replace(MATCHES_TRAILING_SLASH, '');
  process.env.API_URL = process.env.API_URL || `${process.env.URL}/api/`;

  rimrafSync(OUT_PATHNAME);
  await cpy(PUBLIC_FILES_GLOB, OUT_PATHNAME);
  await cpy(
    path.resolve(RESOLUTE_PATHNAME, '**/*.js'),
    path.resolve(OUT_PATHNAME, 'node-modules', '@blinkorb', 'resolute'),
    { filter: (file) => !file.path.includes('/cli/') }
  );
};

export default buildStatic;
