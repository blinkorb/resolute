import React, { ReactNode, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';

import { useIsClientRender } from './hooks.js';
import PreloadProvider from './preload.js';
import RouterProvider from './router.js';
import SettingsProvider from './settings.js';
import {
  LocationInfo,
  PageMeta,
  PreloadFunction,
  ResoluteSettings,
  Router,
} from './types.js';

export interface PageProps {
  location: LocationInfo;
  router: Router;
  meta: PageMeta;
  settings: ResoluteSettings;
  preload: PreloadFunction;
  children?: ReactNode | readonly ReactNode[];
}

const Page = ({
  location,
  router,
  meta,
  settings,
  preload,
  children,
}: PageProps) => {
  const isClientRender = useIsClientRender();

  const removeStyles = useMemo(
    () =>
      'document' in globalThis &&
      globalThis.document.querySelectorAll('[data-jss]'),
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
            {meta.title ? <title>{meta.title}</title> : <title />}
          </Helmet>
          {children}
        </RouterProvider>
      </PreloadProvider>
    </SettingsProvider>
  );
};

export default Page;
