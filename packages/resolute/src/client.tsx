import React, { ReactElement } from 'react';
import { createRoot, hydrateRoot, Root } from 'react-dom/client';

import {
  DEFAULT_PRELOAD_CACHE_TIMEOUT,
  DEFAULT_PRELOAD_ON_FOCUS,
  DEFAULT_PRELOAD_ON_HOVER,
  DEFAULT_TRANSITION_INITIAL_RENDER,
  DEFAULT_VIEW_TRANSITIONS,
  MATCHES_TRAILING_SLASH,
} from './constants.js';
import Page from './page.js';
import {
  PageDataJSON,
  PageDataJSONClient,
  PageDataJSONStatic,
  PreloadFunction,
  ResoluteSettings,
  Router,
  UnknownObject,
} from './types.js';
import {
  getInjectedProps,
  getModuleElement,
  getProps,
} from './utils/component.js';
import { getActiveElementPath, reFocusActiveElement } from './utils/focus.js';
import { getRouter } from './utils/location.js';
import { getModule } from './utils/module.js';
import { toTSX } from './utils/paths.js';

let settings: ResoluteSettings = {};

try {
  settings = (await import('/resolute.settings.js' as string)).default || {};
} catch (error) {
  if (process.env.NODE_ENV === 'development' && globalThis.console) {
    // eslint-disable-next-line no-console
    console.warn('Failed to load resolute.settings.js');
  }
}

declare global {
  interface Document {
    startViewTransition?: (callback: () => void) => void;
  }
}

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

interface LatestLoaded {
  id: string;
  time: number;
}

let prevPage: ClientRenderer | StaticRenderer | undefined;
let latestLoaded: LatestLoaded = {
  id: '',
  time: 0,
};

type CachedPage =
  | {
      resolutePageJson: PageDataJSONClient;
      pageModule: UnknownObject;
      page: ReactElement;
    }
  | {
      resolutePageJson: PageDataJSONStatic;
    }
  | Error;

interface PageCache {
  time: number;
  id: string;
  cache: Promise<CachedPage>;
}

const PAGE_CACHE: Record<string, PageCache> = {};

let preload: PreloadFunction = () => {
  throw new Error('preload not initialized');
};

const renderClient = async (
  pageModule: UnknownObject,
  resolutePageJson: PageDataJSONClient,
  href: string,
  router: Router
) => {
  const { client, static: staticInfo } = resolutePageJson;
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
      settings={settings}
      preload={preload}
    >
      {withLayouts}
    </Page>
  );

  return page;
};

const loadClient = async (
  location: Location | URL,
  resolutePageJson: PageDataJSONClient,
  router: Router
) => {
  const { client } = resolutePageJson;

  const { href } = location;
  const pageModule = await getModule(client.pathname);
  const page = await renderClient(pageModule, resolutePageJson, href, router);

  return {
    resolutePageJson,
    pageModule,
    page,
  };
};

const loadModule = async (location: Location | URL, router: Router) => {
  const resolutePageJson: PageDataJSON | Error = await fetch(
    `${location.protocol}//${location.host}${location.pathname.replace(
      MATCHES_TRAILING_SLASH,
      '/'
    )}resolute.json`
  )
    .then(async (response) => {
      if (response.ok) {
        return response.json();
      }

      return fetch(
        `${location.protocol}//${location.host}/404/resolute.json`
      ).then((pageNotFoundResponse) => {
        if (pageNotFoundResponse.ok) {
          return pageNotFoundResponse.json();
        }

        throw new Error(
          `Failed to load resolute.json for ${location.pathname}${
            pageNotFoundResponse.status === 404
              ? ' and could not find a 404 page to fall back to. Make sure you have defined a 404.page.tsx.'
              : '.'
          }`
        );
      });
    })
    .catch((error) => error);

  if (resolutePageJson instanceof Error) {
    return resolutePageJson;
  }

  if ('client' in resolutePageJson) {
    return loadClient(location, resolutePageJson, router);
  } else if ('static' in resolutePageJson) {
    return {
      resolutePageJson,
    };
  }

  return new Error('Invalid resolute.json');
};

const loadModuleFromCache = async (
  location: Location | URL,
  pathname: string,
  id: string,
  loadTime: number,
  router: Router
) => {
  const cachedPage = PAGE_CACHE[id] || PAGE_CACHE[pathname];

  if (
    cachedPage &&
    loadTime <=
      cachedPage.time +
        (settings.preload?.cacheTimeout ?? DEFAULT_PRELOAD_CACHE_TIMEOUT)
  ) {
    return cachedPage;
  }

  const cache = loadModule(location, router);
  const newPageCache: PageCache = {
    time: loadTime,
    id,
    cache,
  };

  PAGE_CACHE[id] = newPageCache;
  PAGE_CACHE[pathname] = newPageCache;

  return newPageCache;
};

preload = (href: string) => {
  const url = new URL(href, globalThis.location.origin);
  const pathname = url.pathname.replace(MATCHES_TRAILING_SLASH, '/');

  if (
    url.origin === globalThis.location.origin &&
    pathname !==
      globalThis.location.pathname.replace(MATCHES_TRAILING_SLASH, '/')
  ) {
    const id = `${pathname}${url.search}${url.hash}`;
    const loadTime = Date.now();

    const router = getRouter(url.origin, history);

    loadModuleFromCache(url, pathname, id, loadTime, router);
  }
};

const updatePage = async (
  location: Location,
  pageCache: PageCache,
  cache: CachedPage,
  router: Router,
  id: string,
  loadTime: number
) => {
  if (cache instanceof Error) {
    if (process.env.NODE_ENV === 'development') {
      if (prevPage?.root) {
        prevPage.root.unmount();
      }

      globalThis.document.body.innerHTML = `<p style="color: red;">${cache.message}</p>`;
    } else {
      globalThis.location.reload();
    }
    return;
  }

  const { activeElement } = globalThis.document;
  const activeElementTagName = activeElement?.tagName.toLowerCase();
  const activeElementPath = getActiveElementPath(activeElement, []);

  if ('page' in cache) {
    if (id === latestLoaded.id || loadTime >= latestLoaded.time) {
      globalThis.document.head.innerHTML = cache.resolutePageJson.static.head;

      const page =
        pageCache.id === id
          ? cache.page
          : await renderClient(
              cache.pageModule,
              cache.resolutePageJson,
              location.href,
              router
            );
      if (prevPage?.root) {
        prevPage.root.render(page);
      } else if (prevPage?.static || cache.pageModule.hydrate === false) {
        const root = createRoot(globalThis.document.body);
        root.render(page);
        prevPage = {
          root,
        };

        globalThis.requestAnimationFrame(() => {
          if (
            !globalThis.document.activeElement ||
            globalThis.document.activeElement === globalThis.document.body
          ) {
            reFocusActiveElement(
              globalThis.document.body,
              activeElementPath,
              activeElementTagName
            );
          }
        });
      } else {
        prevPage = {
          root: hydrateRoot(globalThis.document.body, page),
        };
      }
    }
  } else if (id === latestLoaded.id || loadTime >= latestLoaded.time) {
    if (prevPage?.root) {
      prevPage.root.unmount();
    }

    if (prevPage) {
      globalThis.document.head.innerHTML = cache.resolutePageJson.static.head;
      globalThis.document.body.innerHTML = cache.resolutePageJson.static.body;

      reFocusActiveElement(
        globalThis.document.body,
        activeElementPath,
        activeElementTagName
      );
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

      if (link.dataset.preload === 'true') {
        preload(link.href);
      }

      if (settings.preload?.onHover ?? DEFAULT_PRELOAD_ON_HOVER) {
        link.addEventListener(
          'mouseover',
          () => {
            preload(link.href);
          },
          {
            passive: true,
          }
        );
      }

      if (settings.preload?.onFocus ?? DEFAULT_PRELOAD_ON_FOCUS) {
        link.addEventListener(
          'focus',
          () => {
            preload(link.href);
          },
          {
            passive: true,
          }
        );
      }
    }
  }
};

const loadPage = async (location: Location) => {
  const pathname = location.pathname.replace(MATCHES_TRAILING_SLASH, '/');
  const id = `${pathname}${location.search}${location.hash}`;
  const loadTime = Date.now();
  latestLoaded = {
    id,
    time: loadTime,
  };

  const router = getRouter(location.origin, history);
  globalThis.document.body.dataset.renderState = 'rendering';

  const pageCache = await loadModuleFromCache(
    location,
    pathname,
    id,
    loadTime,
    router
  );

  const cache = await pageCache.cache;
  const initialRenderTransitions =
    typeof settings.viewTransitions === 'object' &&
    (settings.viewTransitions.initialRender ??
      DEFAULT_TRANSITION_INITIAL_RENDER);

  if (
    (prevPage || initialRenderTransitions) &&
    (settings.viewTransitions ?? DEFAULT_VIEW_TRANSITIONS) &&
    typeof globalThis.document.startViewTransition === 'function'
  ) {
    globalThis.document.startViewTransition(async () => {
      await updatePage(location, pageCache, cache, router, id, loadTime);
      globalThis.document.body.dataset.renderState = 'rendered';
    });
  } else {
    await updatePage(location, pageCache, cache, router, id, loadTime);
    globalThis.document.body.dataset.renderState = 'rendered';
  }
};

globalThis.addEventListener('popstate', () => {
  loadPage(globalThis.location);
});

loadPage(globalThis.location);
