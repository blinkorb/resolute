import path from 'node:path';
import url from 'node:url';

import { readPackageJsonVersion } from './utils/deps.js';

export const CWD = process.cwd();

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

export const RESOLUTE_PATHNAME = path.resolve(__dirname, '../');

export const RESOLUTE_VERSION = readPackageJsonVersion(
  path.resolve(RESOLUTE_PATHNAME, '../package.json')
);

export const SRC_DIR = 'src/';
export const SRC_PATHNAME = path.resolve(CWD, SRC_DIR);
export const STATIC_DIR = 'static/';
export const STATIC_PATHNAME = path.resolve(CWD, STATIC_DIR);
export const SERVER_DIR = 'server/';
export const SERVER_PATHNAME = path.resolve(CWD, SERVER_DIR);
export const PUBLIC_FILES_GLOB = 'public/**/*';

export const MATCHES_LOCAL = /^[./]/;
export const MATCHES_NODE_MODULE = /.*\/node_modules\//;
export const MATCHES_RESOLUTE = /@blinkorb\/resolute|resolute\/build/;
export const MATCHES_PAGE = /\.page\.js$/;
export const MATCHES_CLIENT = /\.client\.js$/;
export const MATCHES_LAYOUT = /\.layout\.js$/;
export const MATCHES_SERVER = /\.server\.js$/;
export const MATCHES_STATIC = /\.static\.js$/;
export const MATCHES_SERVER_STATIC_API = /\.(server|static|api)\.js$/;
export const MATCHES_NODE_MODULE_RELATIVE = /[\w-]+\/[\w-]+/;
