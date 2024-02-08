import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { parentPort, workerData } from 'node:worker_threads';

import metadataParser from 'markdown-yaml-metadata-parser';
import { mkdirpSync } from 'mkdirp';
import React, { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { Helmet } from 'react-helmet';
import { createGenerateId, JssProvider, SheetsRegistry } from 'react-jss';
import ReactMarkdown from 'react-markdown';

import { SCOPED_CLIENT, SCOPED_NAME } from '../../constants.js';
import { Page } from '../../page.js';
import type {
  LayoutJSON,
  LocationInfo,
  PageDataJSON,
  PageMeta,
  ResoluteSettings,
  Router,
} from '../../types.js';
import {
  getInjectedProps,
  getModuleElement,
  getProps,
} from '../../utils/component.js';
import { getLocationInfo } from '../../utils/location.js';
import { getPageMeta } from '../../utils/meta.js';
import { getModule } from '../../utils/module.js';
import { CWD, MATCHES_LOCAL, RESOLUTE_VERSION } from '../constants.js';
import { getAllDependencies } from '../utils/deps.js';
import {
  fromServerPathToRelativeTSX,
  getOutPathnames,
  toStaticPath,
} from '../utils/paths.js';
import type { WorkerData } from './types.js';

const require = createRequire(import.meta.url);

const {
  route,
  info,
  env,
  serverPathname,
  staticPathname,
  nodeModuleDependencies,
  nodeModuleVersionMap,
} = workerData as WorkerData;

Object.entries(env).forEach(([key, value]) => {
  process.env[key] = value;
});

let settings: ResoluteSettings = {};

try {
  settings =
    (await import(path.resolve(serverPathname, 'resolute.settings.js')))
      .default || {};
} catch (error) {
  // eslint-disable-next-line no-console
  console.warn('Failed to load resolute.settings.js');
}

const getElement = async () => {
  const href = `${(process.env.URL || '').replace(/\/?$/, '')}${route}`;

  if (info.markdown) {
    const src = fs.readFileSync(info.markdown, { encoding: 'utf8' });
    const { content, metadata } = metadataParser(src);

    const element = (
      <ReactMarkdown {...settings.markdown}>{content}</ReactMarkdown>
    );

    return {
      element,
      pageProps: {},
      meta: getPageMeta(metadata, info.markdown),
      location: getLocationInfo(href),
      href,
      pathname: info.markdown,
    };
  }

  const pathname = info.static || info.page!;
  const pageModule = await getModule(pathname);
  const pageProps = await getProps(pageModule, pathname);
  const withInjectedProps = getInjectedProps(
    pageModule,
    pathname,
    href,
    pageProps,
    undefined,
    'static'
  );

  const element = await getModuleElement(
    pageModule,
    fromServerPathToRelativeTSX(pathname),
    withInjectedProps
  );

  return {
    element,
    pageProps,
    meta: withInjectedProps.meta,
    location: withInjectedProps.location,
    href,
    pathname,
  };
};

const renderToHTML = async (
  elementWithLayouts: ReactElement,
  meta: PageMeta,
  layoutsJSON: readonly LayoutJSON[],
  location: LocationInfo,
  clientPathname: string | undefined
) => {
  const pageFiles = [
    require.resolve(SCOPED_CLIENT),
    ...(clientPathname
      ? [clientPathname, ...layoutsJSON.map((layout) => layout.pathname)]
      : []),
  ];

  const { list: pageDependencies } = await getAllDependencies(pageFiles);

  const uniquePageDependencies = [
    {
      // Manually included as this is a dynamic import
      module: '/resolute.settings.js',
      resolved: 'server/resolute.settings.js',
    },
    // Include client file and layouts if it can be hydrated
    ...(clientPathname
      ? [
          {
            module: `./${path.basename(clientPathname)}`,
            resolved: path.relative(CWD, clientPathname),
          },
          ...layoutsJSON.map((layout) => ({
            module: `./${path.basename(layout.pathname)}`,
            resolved: path.relative(CWD, layout.pathname),
          })),
        ]
      : []),
    ...pageDependencies,
  ].filter(
    (dep, index, context) =>
      context.findIndex((d) => d.resolved === dep.resolved) === index
  );

  const throwNavigationError = () => {
    throw new Error('You cannot navigate in an ssg/ssr context');
  };

  const router: Router = {
    navigate: throwNavigationError,
    go: throwNavigationError,
    back: throwNavigationError,
    forward: throwNavigationError,
  };

  const preload = () => {
    throw new Error('You cannot preload in an ssg/ssr context');
  };

  const sheets = new SheetsRegistry();
  const generateId = createGenerateId();

  // Render page
  const body = `<div data-resolute-root="true" id="resolute-root">${renderToString(
    <JssProvider registry={sheets} generateId={generateId}>
      <Page
        location={location}
        router={router}
        meta={meta}
        settings={settings}
        preload={preload}
      >
        {elementWithLayouts}
      </Page>
    </JssProvider>
  )}</div>`;

  const helmet = Helmet.renderStatic();
  const headStyles = `<style type="text/css" data-jss>${sheets.toString({
    format: false,
  })}</style>`;

  // Collect head info from helmet
  const headHelmet = [
    helmet.title.toString(),
    helmet.meta.toString(),
    helmet.link.toString(),
    helmet.style.toString(),
    helmet.script.toString(),
  ]
    .filter((str) => str)
    .join('\n');

  const resoluteClientHref = `/node-modules/${SCOPED_NAME}@${RESOLUTE_VERSION}/client.js`;

  // Construct import map
  const importMap = `<script type="importmap">${JSON.stringify({
    imports: nodeModuleDependencies
      .filter((dep) => !MATCHES_LOCAL.test(dep.module))
      .reduce(
        (acc, dep) => {
          return {
            ...acc,
            [dep.module]: `/${toStaticPath(
              dep.resolved,
              nodeModuleVersionMap
            )}`,
          };
        },
        {
          [SCOPED_CLIENT]: resoluteClientHref,
        }
      ),
  })}</script>`;

  const resoluteClient = `<script defer type="module" src="${resoluteClientHref}"></script>`;
  const modulePreload = uniquePageDependencies
    .map((dep) => {
      return `<link rel="modulepreload" href="/${toStaticPath(
        dep.resolved,
        nodeModuleVersionMap
      )}" />`;
    })
    .join('');

  const head = `${headHelmet}${importMap}${modulePreload}${headStyles}`;

  const html = `<!DOCTYPE html><html><head>${head}${resoluteClient}</head><body data-render-state="rendering">${body}</body></html>\n`;

  return {
    head,
    body,
    html,
  };
};

const clientPathname = info.client || info.page;
const { element, pageProps, meta, location, href, pathname } =
  await getElement();

// Wrap page with layouts
const { element: elementWithLayouts, layoutsJSON } = await info.layouts.reduce<
  Promise<{
    element: ReactElement;
    layoutsJSON: readonly LayoutJSON[];
  }>
>(
  async (accPromise, layout) => {
    const acc = await accPromise;
    const layoutModule = await getModule(layout);
    const layoutProps = await getProps(layoutModule, layout);
    const layoutElement = await getModuleElement(
      layoutModule,
      fromServerPathToRelativeTSX(layout),
      getInjectedProps(
        layoutModule,
        pathname,
        href,
        layoutProps,
        acc.element,
        'static'
      )
    );

    return {
      element: layoutElement,
      layoutsJSON: [
        ...acc.layoutsJSON,
        {
          pathname: layout,
          props: layoutProps,
        },
      ],
    };
  },
  Promise.resolve({ element, layoutsJSON: [] })
);

const { head, body, html } = await renderToHTML(
  elementWithLayouts,
  meta,
  layoutsJSON,
  location,
  clientPathname
);

const { outDir, outFileHTML, outFileJSON } = getOutPathnames(
  route,
  staticPathname
);

const json = (
  clientPathname
    ? {
        client: {
          pathname: path
            .relative(serverPathname, clientPathname)
            .replace(/^(\.?\/)?/, '/'),
          layouts: layoutsJSON.map((layout) => ({
            ...layout,
            pathname: `/${path.relative(serverPathname, layout.pathname)}`,
          })),
        },
        static: {
          head,
          meta,
          props: pageProps,
        },
      }
    : {
        static: { head, body },
      }
) satisfies PageDataJSON;

// Output json and html for page
mkdirpSync(outDir);
fs.writeFileSync(outFileHTML, html, { encoding: 'utf8' });
fs.writeFileSync(outFileJSON, JSON.stringify(json), {
  encoding: 'utf8',
});

parentPort?.close();
