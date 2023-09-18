import React, { createContext, ReactNode, useMemo } from 'react';

import {
  AnyObject,
  LocationInfo,
  NavigateOptions,
  RouterContextState,
} from './types.js';

export const RouteContext = createContext<RouterContextState | null>(null);

const RouterProvider = ({
  location,
  children,
}: {
  location: LocationInfo;
  children?: ReactNode | readonly ReactNode[];
}) => {
  const router = useMemo(() => {
    if (globalThis.history) {
      return {
        navigate: (
          pathname: string,
          state?: AnyObject,
          options?: NavigateOptions
        ) => {
          if (options?.hard) {
            window.location.href = pathname;
          } else if (options?.replace) {
            globalThis.history.replaceState(state, '', pathname);
          } else {
            globalThis.history.pushState(state, '', pathname);
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
      };
    }

    const throwHistoryError = () => {
      throw new Error(
        'The history API is not available in this context. Do not attempt navigation in a ssg/ssr context.'
      );
    };

    return {
      navigate: throwHistoryError,
      go: throwHistoryError,
      back: throwHistoryError,
    };
  }, []);

  const routeContext = useMemo(
    () => ({
      location,
      router,
    }),
    [location, router]
  );

  return (
    <RouteContext.Provider value={routeContext}>
      {children}
    </RouteContext.Provider>
  );
};

export default RouterProvider;
