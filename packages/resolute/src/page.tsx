import React, { ReactNode } from 'react';
import { Helmet } from 'react-helmet';

import Router from './router.js';
import { UnknownObject } from './types.js';
import { getPageMeta } from './utils/meta.js';

export interface PageProps {
  pageModule: UnknownObject;
  pathname: string;
  href: string;
  children?: ReactNode | readonly ReactNode[];
}

const Page = ({ pageModule, pathname, href, children }: PageProps) => {
  const meta = getPageMeta(pageModule, pathname);

  return (
    <Router href={href}>
      <Helmet>{!!meta.title && <title>{meta.title}</title>}</Helmet>
      {children}
    </Router>
  );
};

export default Page;
