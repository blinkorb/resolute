import { Link } from '@blinkorb/resolute';
import React, { ReactNode } from 'react';

import styles from './index.scss';

const Layout = ({
  children,
}: {
  children: ReactNode | readonly ReactNode[];
}) => (
  <>
    <header>
      <ul>
        <li>
          <Link className={styles.link} href="/">
            Home (static)
          </Link>
        </li>
        <li>
          <Link className={styles.link} href="/events">
            Events (hydrated async)
          </Link>
        </li>
        <li>
          <Link className={styles.link} href="/about">
            About (overridden layout)
          </Link>
        </li>
        <li>
          <Link className={styles.link} href="/counter">
            Counter (avoid hydration)
          </Link>
        </li>
        <li>
          <Link className={styles.link} href="/client-only">
            Client Only Content (hydrated)
          </Link>
        </li>
        <li>
          <Link className={styles.link} href="/nested-layout">
            Nested Layout (no title)
          </Link>
        </li>
        <li>
          <Link className={styles.link} href="/some-path">
            Hidden Route (helmet title)
          </Link>
        </li>
      </ul>
    </header>
    {children}
  </>
);

export default Layout;
