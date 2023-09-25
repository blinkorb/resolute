import React, { ReactElement } from 'react';
import { createRoot, hydrateRoot, Root } from 'react-dom/client';

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

interface ClientRenderer {
  root: Root;
  static?: false;
}

interface StaticRenderer {
  root?: undefined;
  static: true;
}

let prevPage: ClientRenderer | StaticRenderer | undefined;

const loadPage = async (location: Location) => {
  const resoluteClientJson: PageDataJSON = await fetch(
    `${location.protocol}//${location.host}${location.pathname.replace(
      MATCHES_TRAILING_SLASH,
      ''
    )}/resolute.json`
  ).then((response) => {
    if (response.ok) {
      return response.json();
    }

    throw new Error(
      `Failed to fetch resolute.json for route ${location.pathname}`
    );
  });

  const router = getRouter(location.origin, history);

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
        router={router}
        meta={withInjectedProps.meta}
      >
        {withLayouts}
      </Page>
    );

    globalThis.document.title = '';
    const jssStyles = document.querySelectorAll('[data-jss]');

    for (const jssStyle of jssStyles) {
      jssStyle.remove();
    }

    if (prevPage?.root) {
      prevPage.root.render(page);
    } else if (prevPage?.static || pageModule.hydrate === false) {
      const root = createRoot(globalThis.document.body);
      root.render(page);
      prevPage = {
        root,
      };
    } else {
      prevPage = {
        root: hydrateRoot(globalThis.document.body, page),
      };
    }
  } else if ('static' in resoluteClientJson) {
    if (prevPage?.root) {
      prevPage.root.unmount();
    }

    if (prevPage) {
      globalThis.document.head.innerHTML = resoluteClientJson.static.head;
      globalThis.document.body.innerHTML = resoluteClientJson.static.body;
    }

    prevPage = {
      static: true,
    };

    const links = globalThis.document.getElementsByTagName('a');

    for (const link of links) {
      link.addEventListener(
        'click',
        (event) => {
          const newLocation = new URL(link.href, location.origin);

          if (link.dataset.hard !== 'true' && link.target !== '_blank') {
            event.preventDefault();
            router.navigate(newLocation.href, undefined, {
              hard: link.dataset.hard === 'true',
              replace: link.dataset.replace === 'true',
              scrollToTop: link.dataset.scrollToTop !== 'false',
            });
          }
        },
        {
          passive: false,
        }
      );
    }
  } else {
    throw new Error('Invalid resolute.json');
  }
};

globalThis.addEventListener('popstate', () => {
  loadPage(globalThis.location);
});

loadPage(globalThis.location);
