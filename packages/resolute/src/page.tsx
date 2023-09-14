import React, { ReactNode } from 'react';
import { Helmet } from 'react-helmet';

import { UnknownObject } from './types.js';
import { getPageMeta } from './utils/meta.js';

export interface PageProps {
  pageModule: UnknownObject;
  pathname: string;
  children?: ReactNode | readonly ReactNode[];
}

const Page = ({ pageModule, pathname, children }: PageProps) => {
  const meta = getPageMeta(pageModule, pathname);

  return (
    <>
      <Helmet>{!!meta.title && <title>{meta.title}</title>}</Helmet>
      {children}
    </>
  );
};

export default Page;
