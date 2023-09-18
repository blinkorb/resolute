import { AnyObject, LocationInfo, NavigateOptions } from '../types.js';
import { withLeadingAndTrailingSlash } from './paths.js';

export const getLocationInfo = (href: string): LocationInfo => {
  const url = new URL(href);

  return {
    hash: url.hash,
    host: url.host,
    hostname: url.hostname,
    href: url.href,
    origin: url.origin,
    pathname: withLeadingAndTrailingSlash(url.pathname),
    port: url.port,
    protocol: url.protocol,
    search: url.search,
  };
};

export const getRouter = (origin: string) => ({
  navigate: (
    pathname: string,
    state?: AnyObject,
    options?: NavigateOptions
  ) => {
    const newLocation = getLocationInfo(pathname);
    if (!options?.hard && newLocation.origin === origin) {
      if (options?.replace) {
        globalThis.history.replaceState(state, '', pathname);
      } else {
        globalThis.history.pushState(state, '', pathname);
      }
    } else {
      window.location.href = pathname;
    }

    if (options?.scrollToTop !== false) {
      globalThis.scrollTo(0, 0);
    }
  },
  go: (delta: number, options?: Pick<NavigateOptions, 'scrollToTop'>) => {
    globalThis.history.go(delta);

    if (options?.scrollToTop !== false) {
      globalThis.scrollTo(0, 0);
    }
  },
  back: (options?: Pick<NavigateOptions, 'scrollToTop'>) => {
    globalThis.history.back();

    if (options?.scrollToTop !== false) {
      globalThis.scrollTo(0, 0);
    }
  },
});
