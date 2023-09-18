import { useContext, useEffect, useState } from 'react';

import { RouteContext } from './router.js';

const useIsClientRender = () => {
  const [state, setState] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setState(true);
    }
  }, []);

  return state;
};

const useRouter = () => {
  const routerContext = useContext(RouteContext);

  if (!routerContext) {
    throw new Error('Cannot access router information outside of a router');
  }

  return routerContext.router;
};

const useLocation = () => {
  const routerContext = useContext(RouteContext);

  if (!routerContext) {
    throw new Error('Cannot access router information outside of a router');
  }
  return routerContext.location;
};

export { useIsClientRender, useRouter, useLocation };
