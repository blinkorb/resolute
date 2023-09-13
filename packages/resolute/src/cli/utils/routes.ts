import path from 'node:path';

import { SERVER_PATHNAME } from '../constants.js';

export const pathnameToRoute = (pathname: string) =>
  path
    .relative(SERVER_PATHNAME, pathname)
    // Make absolute
    .replace(/^(\.\/)?/, '/')
    // Remove hidden routes
    .replace(/\/_[\w-]+\//, '/')
    // Resolve index files
    .replace(/\/index\.(page|client|static|server|layout)\.js/, '/')
    // Resolve directories
    .replace(/\.(page|client|static|server|layout)\.js/, '/');

export const isPartialRouteMatch = (route: string, match: string) =>
  route.startsWith(match);
