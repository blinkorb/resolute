import { AnyObject, LocationInfo, NavigateOptions } from '../types.js';
import { withLeadingAndTrailingSlash } from './paths.js';

export const getLocationInfo = (
  href: string,
  origin?: string
): LocationInfo => {
  const url = new URL(href, origin);

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

export const getRouter = (
  origin: string,
  history: Pick<
    History,
    'pushState' | 'replaceState' | 'go' | 'back' | 'forward'
  >
) => ({
  navigate: (
    pathname: string,
    state?: AnyObject,
    options?: NavigateOptions
  ) => {
    const newLocation = new URL(pathname, origin);
    if (!options?.hard && newLocation.origin === origin) {
      if (options?.replace) {
        history.replaceState(state, '', pathname);
      } else {
        history.pushState(state, '', pathname);
      }
    } else {
      globalThis.location.href = pathname;
    }

    if (options?.scrollToTop !== false) {
      globalThis.scrollTo(0, 0);
    }
  },
  go: (delta: number, options?: Pick<NavigateOptions, 'scrollToTop'>) => {
    history.go(delta);

    if (options?.scrollToTop !== false) {
      globalThis.scrollTo(0, 0);
    }
  },
  back: (options?: Pick<NavigateOptions, 'scrollToTop'>) => {
    history.back();

    if (options?.scrollToTop !== false) {
      globalThis.scrollTo(0, 0);
    }
  },
  forward: (options?: Pick<NavigateOptions, 'scrollToTop'>) => {
    history.forward();

    if (options?.scrollToTop !== false) {
      globalThis.scrollTo(0, 0);
    }
  },
});
