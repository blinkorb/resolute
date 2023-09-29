import fs from 'node:fs';
import path from 'node:path';

import { withLeadingAndTrailingSlash } from '../../utils/paths.js';
import { SERVER_PATHNAME, SRC_PATHNAME } from '../constants.js';

export const fromServerPathToRelativeTSX = (pathname: string) => {
  const resolved = path.resolve(
    SRC_PATHNAME,
    path.relative(SERVER_PATHNAME, pathname).replace(/\.js$/, '.tsx')
  );

  if (fs.existsSync(resolved)) {
    return resolved;
  }

  return resolved.replace(/\.tsx$/, '.ts');
};

export const pathnameToRoute = (pathname: string, root: string) =>
  path
    .relative(root, pathname)
    // Make absolute
    .replace(/^(\.\/)?/, '/')
    // Remove hidden routes
    .replace(/\/_[\w-]+\//, '/')
    // Resolve index.md
    .replace(/\/index\.(md|markdown)$/, '/')
    // Remove markdown extension
    .replace(/\.(md|markdown)$/, '/')
    // Resolve module.index.js
    .replace(/\/index\.(page|client|static|server|layout)\.js$/, '/')
    // Resolve index.html
    .replace(/\/index\.html$/, '/')
    // Remove namespace and js extension
    .replace(/\.(page|client|static|server|layout)\.js$/, '/');

export const isPartialRouteMatch = (route: string, match: string) =>
  withLeadingAndTrailingSlash(route).startsWith(
    withLeadingAndTrailingSlash(match)
  );
