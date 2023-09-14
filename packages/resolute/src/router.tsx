import React, { createContext, ReactNode, useContext, useMemo } from 'react';

import { withLeadingAndTrailingSlash } from './cli/utils/paths.js';

export interface LocationInfo {
  hash: string;
  host: string;
  hostname: string;
  href: string;
  origin: string;
  pathname: string;
  port: string;
  protocol: string;
  search: string;
}

export interface RouteInfo {
  location: LocationInfo;
}

const RouteContext = createContext<RouteInfo | null>(null);

const Router = ({
  href,
  children,
}: {
  href: string;
  children?: ReactNode | readonly ReactNode[];
}) => {
  const location = useMemo(() => {
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
  }, [href]);

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

export const useLocation = () => {
  const routeContext = useRouter();

  return routeContext.location;
};
