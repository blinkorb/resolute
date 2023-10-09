import { Link } from '@blinkorb/resolute';
import React, { ReactNode } from 'react';
import { createUseStyles, DefaultTheme, ThemeProvider } from 'react-jss';

const THEME = {
  red: '#f00',
  blue: '#00f',
} satisfies DefaultTheme;

const useStyles = createUseStyles((theme) => ({
  '@keyframes loadingBarRendering': {
    from: {
      width: 0,
    },
    to: {
      width: '100%',
    },
  },
  '@keyframes loadingBarRendered': {
    from: {
      width: '100%',
      opacity: '100%',
    },
    to: {
      width: '100%',
      opacity: 0,
    },
  },
  link: {
    color: theme.red,
  },
  loadingBar: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: 2,
    opacity: 0.8,
  },
  loadingBarInner: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 0,
    height: '100%',
    backgroundColor: theme.blue,
  },
  '@global': {
    body: {
      '&[data-render-state="rendering"] $loadingBarInner': {
        animation: '$loadingBarRendering 5s ease-out forwards',
      },
      '&[data-render-state="rendered"] $loadingBarInner': {
        animation: '$loadingBarRendered 0.5s ease-out forwards',
      },
    },
  },
}));

const Navigation = () => {
  const styles = useStyles();

  return (
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
          <Link preload className={styles.link} href="/client-only">
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
        <li>
          <Link className={styles.link} href="/markdown">
            Markdown
          </Link>
        </li>
        <li>
          <Link className={styles.link} href="/markdown-without-meta">
            Markdown (no metadata)
          </Link>
        </li>
      </ul>
    </header>
  );
};

const LoadingBar = () => {
  const styles = useStyles();

  return (
    <div className={styles.loadingBar}>
      <div className={styles.loadingBarInner} />
    </div>
  );
};

const Layout = ({
  children,
}: {
  children: ReactNode | readonly ReactNode[];
}) => (
  <ThemeProvider theme={THEME}>
    <LoadingBar />
    <Navigation />
    {children}
  </ThemeProvider>
);

export default Layout;
