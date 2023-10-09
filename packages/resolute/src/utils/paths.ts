import {
  MATCHES_API,
  MATCHES_JS_EXTENSION,
  MATCHES_TRAILING_SLASH,
} from '../constants.js';

export const withLeadingSlash = (pathname: string) =>
  pathname.replace(/^(\.?\/)?/, '/');

export const withTrailingSlash = (pathname: string) =>
  pathname.replace(MATCHES_TRAILING_SLASH, '/');

export const withLeadingAndTrailingSlash = (pathname: string) =>
  pathname.replace(/^(\.?\/)?/, '/').replace(MATCHES_TRAILING_SLASH, '/');

export const toAPIPath = (pathname: string, fn: string) => {
  const result = pathname
    .replace(/^(\.?\/)?/, '')
    .replace(MATCHES_API, '')
    .replace(/index$/, '')
    .replace(/\/+/g, '/');

  if (!result || result === '/') {
    return fn;
  }

  return result.replace(MATCHES_TRAILING_SLASH, `/${fn}`);
};

export const toTSX = (pathname: string) =>
  pathname.replace(MATCHES_JS_EXTENSION, '.tsx');
