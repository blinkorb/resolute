import React, { ReactNode } from 'react';
import { Helmet } from 'react-helmet';

import { UnknownObject } from './types.js';

export interface PageProps {
  pageModule: UnknownObject;
  pathname: string;
  children?: ReactNode | readonly ReactNode[];
}

const getTitle = (pageModule: UnknownObject, pathname: string) => {
  const { title } = pageModule;
  if (typeof title !== 'string' && typeof title !== 'number') {
    throw new Error(`Title must be a string or number in "${pathname}"`);
  }

  return title;
};

const Page = ({ pageModule, pathname, children }: PageProps) => {
  return (
    <>
      <Helmet>
        {'title' in pageModule && (
          <title>{getTitle(pageModule, pathname)}</title>
        )}
      </Helmet>
      {children}
    </>
  );
};

export default Page;
