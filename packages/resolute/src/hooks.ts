import { useContext, useEffect, useState } from 'react';

import { PreloadContext } from './preload.js';
import { RouteContext } from './router.js';
import { SettingsContext } from './settings.js';
import { isBrowser } from './utils/environment.js';

const useIsClientRender = () => {
  const [state, setState] = useState(false);

  useEffect(() => {
    if (isBrowser()) {
      setState(true);
    }
  }, []);

  return state;
};

const useRouter = () => {
  const routerContext = useContext(RouteContext);

  if (!routerContext) {
    throw new Error('Cannot access router outside of a RouterProvider');
  }

  return routerContext.router;
};

const useLocation = () => {
  const routerContext = useContext(RouteContext);

  if (!routerContext) {
    throw new Error(
      'Cannot access location information outside of a RouterProvider'
    );
  }
  return routerContext.location;
};

const useSettings = () => {
  const settings = useContext(SettingsContext);

  if (!settings) {
    throw new Error('Cannot access settings outside of a SettingsProvider');
  }

  return settings;
};

const usePreload = () => {
  const preload = useContext(PreloadContext);

  if (!preload) {
    throw new Error('Cannot access preload outside of a PreloadProvider');
  }

  return preload;
};

export { useIsClientRender, useRouter, useLocation, useSettings, usePreload };
