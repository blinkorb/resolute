import fs from 'node:fs';
import path from 'node:path';

const MATCHES_INLINE_SOURCE_MAP =
  /\/\/# sourceMappingURL=data:application\/json;(?:charset=utf-8;)?base64,([a-zA-Z0-9+/]+={0,2})[\n\s]*$/;

export const extractSourceMap = (pathname: string) => {
  const dirname = path.dirname(pathname);
  const filename = path.basename(pathname);
  const sourceMapName = `${filename}.map`;
  const content = fs.readFileSync(pathname, 'utf8');

  const match = MATCHES_INLINE_SOURCE_MAP.exec(content);

  if (!match) {
    throw new Error(`No inline source map found for "${pathname}"`);
  }

  const [, base64] = match;
  const json = atob(base64!);

  fs.writeFileSync(
    pathname,
    content.replace(
      MATCHES_INLINE_SOURCE_MAP,
      `//# sourceMappingURL=${sourceMapName}\n`
    )
  );
  fs.writeFileSync(path.join(dirname, sourceMapName), json);
};
