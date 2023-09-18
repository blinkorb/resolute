import React, { ReactNode } from 'react';
import { Helmet } from 'react-helmet';

import RouterProvider from './router.js';
import { LocationInfo, PageMeta } from './types.js';

export interface PageProps {
  location: LocationInfo;
  meta: PageMeta;
  children?: ReactNode | readonly ReactNode[];
}

const Page = ({ location, meta, children }: PageProps) => (
  <RouterProvider location={location}>
    <Helmet>{!!meta.title && <title>{meta.title}</title>}</Helmet>
    {children}
  </RouterProvider>
);

export default Page;
