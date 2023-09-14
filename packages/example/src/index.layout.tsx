import React, { ReactNode } from 'react';

const Layout = ({
  children,
}: {
  children: ReactNode | readonly ReactNode[];
}) => (
  <>
    <header>
      <ul>
        <li>
          <a href="/">Home</a>
        </li>
        <li>
          <a href="/events">Events</a>
        </li>
        <li>
          <a href="/about">About</a>
        </li>
        <li>
          <a href="/counter">Counter</a>
        </li>
        <li>
          <a href="/client-only">Client Only</a>
        </li>
      </ul>
    </header>
    {children}
  </>
);

export default Layout;
