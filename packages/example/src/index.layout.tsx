import { Link } from '@blinkorb/resolute';
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
          <Link href="/">Home (static)</Link>
        </li>
        <li>
          <Link href="/events">Events (hydrated)</Link>
        </li>
        <li>
          <Link href="/about">About (overridden layout)</Link>
        </li>
        <li>
          <Link href="/counter">Counter (avoid hydration)</Link>
        </li>
        <li>
          <Link href="/client-only">Client Only Content</Link>
        </li>
        <li>
          <Link href="/nested-layout">Nested Layout (no title)</Link>
        </li>
        <li>
          <Link href="/some-path">Hidden Route (helmet title)</Link>
        </li>
      </ul>
    </header>
    {children}
  </>
);

export default Layout;
