import path from 'node:path';

import { withLeadingAndTrailingSlash } from '../../utils/paths.js';
import { SERVER_PATHNAME, SRC_PATHNAME } from '../constants.js';

export const fromServerPathToRelativeTSX = (pathname: string) =>
  path.resolve(
    SRC_PATHNAME,
    path.relative(SERVER_PATHNAME, pathname).replace(/\.js$/, '.tsx')
  );

export const pathnameToRoute = (pathname: string) =>
  path
    .relative(SERVER_PATHNAME, pathname)
    // Make absolute
    .replace(/^(\.\/)?/, '/')
    // Remove hidden routes
    .replace(/\/_[\w-]+\//, '/')
    // Resolve module.index.js
    .replace(/\/index\.(page|client|static|server|layout)\.js/, '/')
    // Resolve index.html
    .replace(/\/index\.html$/, '/')
    // Resolve directories
    .replace(/\.(page|client|static|server|layout)\.js/, '/');

export const isPartialRouteMatch = (route: string, match: string) =>
  withLeadingAndTrailingSlash(route).startsWith(
    withLeadingAndTrailingSlash(match)
  );

export const toStaticNodeModulePath = (
  pathname: string,
  nodeModulesVersionMap: Record<string, string>
) =>
  pathname.replace(
    /^.*node_modules\/(@[\w-]+\/[\w-]+|[\w-]+)(\/.+)/,
    (_match, moduleName, rest) => {
      return `node-modules/${moduleName}@${nodeModulesVersionMap[moduleName]}${rest}`;
    }
  );
