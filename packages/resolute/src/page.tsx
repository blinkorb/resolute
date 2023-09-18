import React, { ReactNode } from 'react';
import { Helmet } from 'react-helmet';

import Router from './router.js';
import { PageMeta } from './types.js';

export interface PageProps {
  href: string;
  meta: PageMeta;
  children?: ReactNode | readonly ReactNode[];
}

const Page = ({ href, meta, children }: PageProps) => (
  <Router href={href}>
    <Helmet>{!!meta.title && <title>{meta.title}</title>}</Helmet>
    {children}
  </Router>
);

export default Page;
