import React, {
  FocusEvent,
  HTMLAttributes,
  MouseEvent,
  useCallback,
  useEffect,
} from 'react';

import {
  DEFAULT_PRELOAD_ON_FOCUS,
  DEFAULT_PRELOAD_ON_HOVER,
} from './constants.js';
import {
  useIsClientRender,
  usePreload,
  useRouter,
  useSettings,
} from './hooks.js';
import { AnyObject, NavigateOptions } from './types.js';

export interface LinkProps
  extends HTMLAttributes<HTMLAnchorElement>,
    NavigateOptions {
  href: string;
  state?: AnyObject;
  target?: '_self' | '_blank';
  preload?: boolean;
}

const Link = ({
  href,
  target,
  hard,
  replace,
  scrollToTop,
  state,
  preload: shouldPreload,
  onClick,
  onMouseOver,
  onFocus,
  children,
  ...props
}: LinkProps) => {
  const isClientRender = useIsClientRender();
  const { navigate } = useRouter();
  const settings = useSettings();
  const preload = usePreload();
  const preloadOnHover = settings.preload?.onHover ?? DEFAULT_PRELOAD_ON_HOVER;
  const preloadOnFocus = settings.preload?.onFocus ?? DEFAULT_PRELOAD_ON_FOCUS;

  useEffect(() => {
    if (shouldPreload && isClientRender) {
      preload(href);
    }
  }, [shouldPreload, isClientRender, href, preload]);

  const onClickWrapper = useCallback(
    async (event: MouseEvent<HTMLAnchorElement>) => {
      if (!hard && target !== '_blank') {
        event.preventDefault();
        await onClick?.(event);

        navigate(href, state, {
          hard,
          replace,
          scrollToTop,
        });
      }
    },
    [href, hard, target, onClick, replace, scrollToTop, navigate, state]
  );

  const onMouseOverWrapper = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      onMouseOver?.(event);

      if (preloadOnHover) {
        preload(href);
      }
    },
    [onMouseOver, preloadOnHover, preload, href]
  );

  const onFocusWrapper = useCallback(
    (event: FocusEvent<HTMLAnchorElement>) => {
      onFocus?.(event);

      if (preloadOnFocus) {
        preload(href);
      }
    },
    [onFocus, preloadOnFocus, preload, href]
  );

  return (
    <a
      {...props}
      href={href}
      target={target}
      data-hard={hard}
      data-replace={replace}
      data-scroll-to-top={scrollToTop}
      data-preload={shouldPreload}
      onClick={onClickWrapper}
      onMouseOver={onMouseOverWrapper}
      onFocus={onFocusWrapper}
    >
      {children}
    </a>
  );
};

export { Link };
