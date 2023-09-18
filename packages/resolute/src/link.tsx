import React, { HTMLAttributes, MouseEvent, useCallback } from 'react';

import { useRouter } from './hooks.js';
import { AnyObject, NavigateOptions } from './types.js';

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
  const { navigate } = useRouter();

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
