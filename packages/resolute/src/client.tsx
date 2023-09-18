import React, { ReactElement } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';

import { MATCHES_TRAILING_SLASH } from './constants.js';
import Page from './page.js';
import { PageDataJSON } from './types.js';
import {
  getInjectedProps,
  getModuleElement,
  getProps,
} from './utils/component.js';
import { getRouter } from './utils/location.js';
import { getModule } from './utils/module.js';
import { toTSX } from './utils/paths.js';

const history = {
  pushState: (data: unknown, title: string, url: string) => {
    globalThis.history.pushState(data, title, url);
    globalThis.dispatchEvent(new Event('popstate'));
  },
  replaceState: (data: unknown, title: string, url: string) => {
    globalThis.history.replaceState(data, title, url);
    globalThis.dispatchEvent(new Event('popstate'));
  },
  back: () => {
    globalThis.history.back();
    globalThis.dispatchEvent(new Event('popstate'));
  },
  forward: () => {
    globalThis.history.forward();
    globalThis.dispatchEvent(new Event('popstate'));
  },
  go: (delta: number) => {
    globalThis.history.go(delta);
    globalThis.dispatchEvent(new Event('popstate'));
  },
};

const loadPage = async (location: Location) => {
  const resoluteClientJson: PageDataJSON = await fetch(
    `${window.location.protocol}//${
      window.location.host
    }${window.location.pathname.replace(
      MATCHES_TRAILING_SLASH,
      ''
    )}/resolute.json`
  ).then((response) => {
    if (response.ok) {
      return response.json();
    }

    throw new Error(
      `Failed to fetch resolute.json for route ${window.location.pathname}`
    );
  });

  if ('client' in resoluteClientJson) {
    const { client, static: staticInfo } = resoluteClientJson;

    const { href } = location;
    const pageModule = await getModule(client.pathname);
    const props = await getProps(pageModule, client.pathname);
    const withInjectedProps = getInjectedProps(
      pageModule,
      toTSX(client.pathname),
      href,
      staticInfo.props ? { ...staticInfo.props, ...props } : props,
      undefined,
      'client'
    );
    const element = await getModuleElement(
      pageModule,
      client.pathname,
      withInjectedProps
    );

    const withLayouts = await client.layouts.reduce<Promise<ReactElement>>(
      async (accPromise, layout) => {
        const acc = await accPromise;
        const layoutModule = await getModule(layout.pathname);
        const layoutProps = layout.props ?? {};
        const layoutElement = await getModuleElement(
          layoutModule,
          layout.pathname,
          getInjectedProps(
            layoutModule,
            toTSX(layout.pathname),
            href,
            layoutProps,
            acc,
            'client'
          )
        );

        return layoutElement;
      },
      Promise.resolve(element)
    );

    const page = (
      <Page
        location={withInjectedProps.location}
        router={getRouter(location.origin, history)}
        meta={withInjectedProps.meta}
      >
        {withLayouts}
      </Page>
    );

    if (pageModule.hydrate === false) {
      const root = createRoot(window.document.body);
      root.render(page);
    } else {
      hydrateRoot(window.document.body, page);
    }
  }
};

loadPage(window.location);
