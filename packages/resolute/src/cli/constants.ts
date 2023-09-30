import path from 'node:path';

import { JS_EXTENSIONS } from '../constants.js';

export const CWD = process.cwd();

export const SRC_EXTENSIONS = [...JS_EXTENSIONS, 'jsx', 'ts', 'tsx', 'mts'];
export const MARKDOWN_EXTENSIONS = ['md', 'markdown'];

export const SRC_DIR = 'src/';
export const SRC_PATHNAME = path.resolve(CWD, SRC_DIR);
export const STATIC_DIR = 'static/';
export const STATIC_PATHNAME = path.resolve(CWD, STATIC_DIR);
export const SERVER_DIR = 'server/';
export const SERVER_PATHNAME = path.resolve(CWD, SERVER_DIR);
export const PUBLIC_FILES_GLOB = 'public/**/*';

export const MATCHES_LOCAL = /^[./]/;

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

export const MATCHES_MARKDOWN_EXTENSION = new RegExp(
  `\\.(?:${MARKDOWN_EXTENSIONS.join('|')})$`
);

export const GLOB_JS_EXTENSION = `.{${JS_EXTENSIONS.join(',')}}`;
export const GLOB_SRC_EXTENSION = `.{${SRC_EXTENSIONS.join(',')}}`;
export const GLOB_MARKDOWN_EXTENSION = `.{${MARKDOWN_EXTENSIONS.join(',')}}`;
