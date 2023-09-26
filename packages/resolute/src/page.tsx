import React, { ReactNode, useEffect } from 'react';
import { Helmet } from 'react-helmet';

import { useIsClientRender } from './hooks.js';
import RouterProvider from './router.js';
import { LocationInfo, PageMeta, Router } from './types.js';

export interface PageProps {
  location: LocationInfo;
  router: Router;
  meta: PageMeta;
  removeStyles?: NodeListOf<Element> | null;
  children?: ReactNode | readonly ReactNode[];
}

const Page = ({
  location,
  router,
  meta,
  children,
  removeStyles,
}: PageProps) => {
  const isClientRender = useIsClientRender();

  useEffect(() => {
    if (isClientRender && removeStyles) {
      for (const style of removeStyles) {
        style.remove();
      }
    }
  }, [removeStyles, isClientRender]);

  return (
    <RouterProvider location={location} router={router}>
      <Helmet>{meta.title ? <title>{meta.title}</title> : <title />}</Helmet>
      {children}
    </RouterProvider>
  );
};

export default Page;
