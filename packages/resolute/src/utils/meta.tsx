import React, { ReactElement } from 'react';

import {
  AllowedMetaTypes,
  GetMetaType,
  PageMeta,
  TypeOf,
  UnknownObject,
} from '../types.js';

const ALLOW_STRING = ['string'] as const;

type SupportedMeta = {
  [P in keyof PageMeta]: {
    key: P;
    fallback?: keyof PageMeta;
    render: (value: GetMetaType<P>) => ReactElement;
    allow: readonly AllowedMetaTypes[P][number][];
  };
}[keyof PageMeta];

export const SUPPORTED_META = [
  {
    key: 'title',
    render: (value) => <title key="title">{value}</title>,
    allow: ALLOW_STRING,
  },
  {
    key: 'description',
    render: (value) => (
      <meta key="description" name="description" content={value} />
    ),
    allow: ALLOW_STRING,
  },
  {
    key: 'ogTitle',
    fallback: 'title',
    render: (value) => (
      <meta key="og:title" property="og:title" content={value} />
    ),
    allow: ALLOW_STRING,
  },
  {
    key: 'ogDescription',
    fallback: 'description',
    render: (value) => (
      <meta key="og:description" property="og:description" content={value} />
    ),
    allow: ALLOW_STRING,
  },
  {
    key: 'ogImage',
    render: (value) => (
      <meta key="og:image" property="og:image" content={value} />
    ),
    allow: ALLOW_STRING,
  },
  {
    key: 'ogVideo',
    render: (value) => (
      <meta key="og:video" property="og:video" content={value} />
    ),
    allow: ALLOW_STRING,
  },
  {
    key: 'ogUrl',
    render: (value) => <meta key="og:url" property="og:url" content={value} />,
    allow: ALLOW_STRING,
  },
  {
    key: 'ogType',
    render: (value) => (
      <meta key="og:type" property="og:type" content={value} />
    ),
    allow: ALLOW_STRING,
  },
  {
    key: 'ogLocale',
    render: (value) => (
      <meta key="og:locale" property="og:locale" content={value} />
    ),
    allow: ALLOW_STRING,
  },
  {
    key: 'ogSiteName',
    render: (value) => (
      <meta key="og:site_name" property="og:site_name" content={value} />
    ),
    allow: ALLOW_STRING,
  },
] satisfies readonly SupportedMeta[];

export const getPageMeta = (pageModule: UnknownObject, pathname: string) => {
  const meta: PageMeta = {};

  for (const metaProperty of SUPPORTED_META) {
    const { key, allow } = metaProperty;
    if (key in pageModule) {
      const value = pageModule[key];

      if (!(allow as readonly TypeOf[]).includes(typeof value)) {
        throw new Error(
          `Meta "${key}" must be one of ${allow
            .map((a) => `"${a}"`)
            .join(', ')} in "${pathname}"`
        );
      }

      meta[key] = value as GetMetaType<typeof key>;
    }
  }

  return meta;
};
