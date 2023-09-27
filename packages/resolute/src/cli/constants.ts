import path from 'node:path';
import url from 'node:url';

import { NAME, SCOPE } from '../constants.js';
import { readPackageJsonVersion } from './utils/deps.js';

export const CWD = process.cwd();

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

export const RESOLUTE_SRC_PATHNAME = path.resolve(__dirname, '../');

export const RESOLUTE_VERSION = readPackageJsonVersion(
  path.resolve(RESOLUTE_SRC_PATHNAME, '../package.json')
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
export const MATCHES_RESOLUTE = new RegExp(
  `${SCOPE}\\/${NAME}|${NAME}\\/build`
);
export const MATCHES_MARKDOWN = /\.(md|markdown)$/;
export const MATCHES_PAGE = /\.page\.[mc]?js$/;
export const MATCHES_CLIENT = /\.client\.[mc]?js$/;
export const MATCHES_LAYOUT = /\.layout\.[mc]?js$/;
export const MATCHES_SERVER = /\.server\.[mc]?js$/;
export const MATCHES_STATIC = /\.static\.[mc]?js$/;
export const MATCHES_SERVER_STATIC_API = /\.(server|static|api)\.[mc]?js$/;
export const MATCHES_MODULE_SCOPE_AND_NAME =
  /^(@[a-z0-9_.-]+\/[a-z0-9_.-]+|[a-z0-9_.-]+)/;
export const MATCHES_JS_EXTENSION = /\.[mc]?js$/;

export const GLOB_JS_EXTENSION = '.{cjs,mjs,js}';
export const GLOB_SRC_EXTENSION = '.{cjs,mjs,js,jsx,ts,tsx,mts}';
export const GLOB_MARKDOWN_EXTENSION = '.{md,markdown}';
