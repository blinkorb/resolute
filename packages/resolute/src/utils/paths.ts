export const withLeadingSlash = (pathname: string) =>
  pathname.replace(/^(\.?\/)?/, '/');

export const withTrailingSlash = (pathname: string) =>
  pathname.replace(/\/?$/, '/');

export const withLeadingAndTrailingSlash = (pathname: string) =>
  pathname.replace(/^(\.?\/)?/, '/').replace(/\/?$/, '/');

export const toAPIPath = (pathname: string, fn: string) => {
  const result = pathname
    .replace(/^(\.?\/)?/, '')
    .replace(/\.api\.js$/, '')
    .replace(/index$/, '')
    .replace(/\/+/g, '/');

  if (!result || result === '/') {
    return fn;
  }

  return result.replace(/\/?$/, `/${fn}`);
};
