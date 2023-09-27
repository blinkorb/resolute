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

export const JS_EXTENSIONS = ['cjs', 'mjs', 'js'];
export const SRC_EXTENSIONS = [...JS_EXTENSIONS, 'jsx', 'ts', 'tsx', 'mts'];
export const MARKDOWN_EXTENSIONS = ['md', 'markdown'];

export const MATCHES_LOCAL = /^[./]/;
export const MATCHES_NODE_MODULE = /.*\/node_modules\//;

export const MATCHES_RESOLUTE = new RegExp(
  `${SCOPE}\\/${NAME}|${NAME}\\/build`
);

export const MATCHES_PAGE = new RegExp(
  `\\.page\\.(?:${JS_EXTENSIONS.join('|')})$`
);
export const MATCHES_CLIENT = new RegExp(
  `\\.client\\.(?:${JS_EXTENSIONS.join('|')})$`
);
export const MATCHES_LAYOUT = new RegExp(
  `\\.layout\\.(?:${JS_EXTENSIONS.join('|')})$`
);
export const MATCHES_SERVER = new RegExp(
  `\\.server\\.(?:${JS_EXTENSIONS.join('|')})$`
);
export const MATCHES_STATIC = new RegExp(
  `\\.static\\.(?:${JS_EXTENSIONS.join('|')})$`
);
export const MATCHES_SERVER_STATIC_API = new RegExp(
  `\\.(server|static|api)\\.(?:${JS_EXTENSIONS.join('|')})$`
);

export const MATCHES_MODULE_SCOPE_AND_NAME =
  /^(@[a-z0-9_.-]+\/[a-z0-9_.-]+|[a-z0-9_.-]+)/;

export const MATCHES_JS_EXTENSION = new RegExp(
  `\\.(?:${JS_EXTENSIONS.join('|')})$`
);
export const MATCHES_MARKDOWN_EXTENSION = new RegExp(
  `\\.(?:${MARKDOWN_EXTENSIONS.join('|')})$`
);

export const GLOB_JS_EXTENSION = `.{${JS_EXTENSIONS.join(',')}}`;
export const GLOB_SRC_EXTENSION = `.{${SRC_EXTENSIONS.join(',')}}`;
export const GLOB_MARKDOWN_EXTENSION = `.{${MARKDOWN_EXTENSIONS.join(',')}}`;
