import path from 'node:path';
import url from 'node:url';

export const CWD = process.cwd();

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

export const RESOLUTE_PATHNAME = path.resolve(__dirname, '../');

export const SRC_DIR = 'src/';
export const SRC_PATHNAME = path.resolve(CWD, SRC_DIR);
export const STATIC_DIR = 'static/';
export const STATIC_PATHNAME = path.resolve(CWD, STATIC_DIR);
export const PUBLIC_FILES_GLOB = 'public/**/*';

export const MATCHES_LOCAL = /^[./]/;
export const MATCHES_NODE_MODULE = /.*\/node_modules\//;
export const MATCHES_RESOLUTE = /@blinkorb\/resolute|resolute\/build/;
export const MATCHES_CLIENT = /\.(page|client|layout)\./;
export const MATCHES_SERVER = /\.(server|static|api)\./;
