import React, { ReactNode, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';

import { useIsClientRender } from './hooks.js';
import { PreloadProvider } from './preload.js';
import { RouterProvider } from './router.js';
import { SettingsProvider } from './settings.js';
import {
  LocationInfo,
  PageMeta,
  PreloadFunction,
  ResoluteSettings,
  Router,
} from './types.js';
import { isBrowser } from './utils/environment.js';
import { SUPPORTED_META } from './utils/meta.js';

export interface PageProps {
  location: LocationInfo;
  router: Router;
  meta: PageMeta;
  settings: ResoluteSettings;
  preload: PreloadFunction;
  children?: ReactNode | readonly ReactNode[];
}

export const Page = ({
  location,
  router,
  meta,
  settings,
  preload,
  children,
}: PageProps) => {
  const isClientRender = useIsClientRender();

  const removeStyles = useMemo(
    () => isBrowser() && globalThis.document.querySelectorAll('[data-jss]'),
    []
  );

  useEffect(() => {
    if (isClientRender && removeStyles) {
      for (const style of removeStyles) {
        style.remove();
      }
    }
  }, [removeStyles, isClientRender]);

  return (
    <SettingsProvider settings={settings}>
      <PreloadProvider preload={preload}>
        <RouterProvider location={location} router={router}>
          <Helmet {...settings.helmet}>
            {SUPPORTED_META.map(({ key, fallback, render }) => {
              const value =
                meta[key] ?? (fallback ? meta[fallback] : undefined);
              return typeof value !== 'undefined' ? render(value) : null;
            })}
            <meta
              name="viewport"
              content="width=device-width, initial-scale=1"
            />
          </Helmet>
          {children}
        </RouterProvider>
      </PreloadProvider>
    </SettingsProvider>
  );
};

Page.displayName = 'ResolutePage';
