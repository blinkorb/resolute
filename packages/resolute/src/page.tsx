import React, { ReactNode } from 'react';
import { Helmet } from 'react-helmet';

import RouterProvider from './router.js';
import { LocationInfo, PageMeta, Router } from './types.js';

export interface PageProps {
  location: LocationInfo;
  router: Router;
  meta: PageMeta;
  children?: ReactNode | readonly ReactNode[];
}

const Page = ({ location, router, meta, children }: PageProps) => (
  <RouterProvider location={location} router={router}>
    <Helmet>{!!meta.title && <title>{meta.title}</title>}</Helmet>
    {children}
  </RouterProvider>
);

export default Page;
