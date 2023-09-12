import path from 'node:path';
import url from 'node:url';

export const CWD = process.cwd();

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

export const RESOLUTE_PATHNAME = path.resolve(__dirname, '../');

export const SRC_DIR = 'src/';
export const SRC_PATHNAME = path.resolve(CWD, SRC_DIR);
export const OUT_DIR = 'static/';
export const OUT_PATHNAME = path.resolve(CWD, OUT_DIR);
export const PUBLIC_FILES_GLOB = 'public/**/*';

export const MATCHES_LOCAL = /^[./]/;
