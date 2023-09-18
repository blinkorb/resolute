import React, { HTMLAttributes, MouseEvent, useCallback } from 'react';

import { useLocation, useRouter } from './hooks.js';
import { AnyObject, NavigateOptions } from './types.js';
import { getLocationInfo } from './utils/location.js';

export interface LinkProps
  extends HTMLAttributes<HTMLAnchorElement>,
    NavigateOptions {
  href: string;
  state?: AnyObject;
  target?: '_self' | '_blank';
}

const Link = ({
  href,
  target,
  hard,
  replace,
  scrollToTop,
  state,
  onClick,
  children,
  ...props
}: LinkProps) => {
  const router = useRouter();
  const location = useLocation();

  const onClickWrapper = useCallback(
    async (event: MouseEvent<HTMLAnchorElement>) => {
      const newLocation = getLocationInfo(href);

      if (
        !hard &&
        target !== '_blank' &&
        newLocation.origin === location.origin
      ) {
        event.preventDefault();
        await onClick?.(event);

        router.navigate(href, state, {
          hard,
          replace,
          scrollToTop,
        });
      }
    },
    [
      href,
      hard,
      target,
      location.origin,
      onClick,
      replace,
      scrollToTop,
      router,
      state,
    ]
  );

  return (
    <a
      {...props}
      href={href}
      target={target}
      data-hard={hard}
      data-replace={replace}
      data-scroll-to-top={scrollToTop}
      onClick={onClickWrapper}
    >
      {children}
    </a>
  );
};

export { Link };
