import React, { createContext, ReactNode, useMemo } from 'react';

import { LocationInfo, RouterContextState } from './types.js';
import { getRouter } from './utils/location.js';

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
      return getRouter(location.origin);
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
  }, [location.origin]);

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
