import fs from 'node:fs';
import path from 'node:path';

import { SCOPED_NAME } from '../../constants.js';
import { withLeadingAndTrailingSlash } from '../../utils/paths.js';
import {
  MATCHES_NODE_MODULE,
  MATCHES_RESOLUTE,
  RESOLUTE_VERSION,
  SERVER_PATHNAME,
  SRC_PATHNAME,
} from '../constants.js';

export const getDepth = (pathname: string, root: string) => {
  const relative = path.relative(root, pathname);
  const depth = relative.split('/').length;

  return depth;
};

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

export const pathnameToRouteWithHidden = (pathname: string) =>
  pathname
    // Make absolute
    .replace(/^(\.\/)?/, '/')
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

export const isPartialPathMatch = (
  pathname: string,
  layoutPathname: string
) => {
  return pathnameToRouteWithHidden(pathname).startsWith(
    pathnameToRouteWithHidden(layoutPathname)
  );
};

export const toStaticPath = (
  pathname: string,
  nodeModulesVersionMap: Record<string, string>
) => {
  if (MATCHES_RESOLUTE.test(pathname)) {
    return pathname.replace(
      MATCHES_RESOLUTE,
      `node-modules/${SCOPED_NAME}@${RESOLUTE_VERSION}$1`
    );
  }

  if (MATCHES_NODE_MODULE.test(pathname)) {
    return pathname.replace(
      /^.*node_modules\/(@[a-z0-9_.-]+\/[a-z0-9_.-]+|[a-z0-9_.-]+)(\/.+)/,
      (_match, moduleName, rest) => {
        return `node-modules/${moduleName}@${nodeModulesVersionMap[moduleName]}${rest}`;
      }
    );
  }

  if (/^server\//.test(pathname)) {
    return pathname.replace(/^server\//, '');
  }

  throw new Error(`Cannot convert pathname to static path: ${pathname}`);
};
