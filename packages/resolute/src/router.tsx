import React, { createContext, ReactNode, useMemo } from 'react';

import { LocationInfo, Router, RouterContextState } from './types.js';

export const RouteContext = createContext<RouterContextState | null>(null);

export const RouterProvider = ({
  location,
  router,
  children,
}: {
  location: LocationInfo;
  router: Router;
  children?: ReactNode | readonly ReactNode[];
}) => {
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

RouterProvider.displayName = 'ResoluteRouterProvider';
