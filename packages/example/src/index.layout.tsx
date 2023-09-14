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
          <a href="/events">Events (hydrated)</a>
        </li>
        <li>
          <a href="/about">About (overridden layout)</a>
        </li>
        <li>
          <a href="/counter">Counter (avoid hydration)</a>
        </li>
        <li>
          <a href="/client-only">Client Only</a>
        </li>
        <li>
          <a href="/nested-layout">Nested Layout</a>
        </li>
        <li>
          <a href="/some-path">Hidden Route</a>
        </li>
      </ul>
    </header>
    {children}
  </>
);

export default Layout;
