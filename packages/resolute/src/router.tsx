import React, { createContext, ReactNode, useContext, useMemo } from 'react';

import { LocationInfo, RouteInfo } from './types.js';
import { withLeadingAndTrailingSlash } from './utils/paths.js';

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

const RouteContext = createContext<RouteInfo | null>(null);

const Router = ({
  href,
  children,
}: {
  href: string;
  children?: ReactNode | readonly ReactNode[];
}) => {
  const location = useMemo(() => getLocationInfo(href), [href]);

  const routeContext = useMemo(
    () => ({
      location,
    }),
    [location]
  );

  return (
    <RouteContext.Provider value={routeContext}>
      {children}
    </RouteContext.Provider>
  );
};

export default Router;

export const useRouter = () => {
  const routeContext = useContext(RouteContext);

  if (!routeContext) {
    throw new Error('Cannot access router information outside of a router');
  }

  return routeContext;
};

export const useLocation = () => useRouter().location;
