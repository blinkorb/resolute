# @blinkorb/resolute

**Bleeding edge React static/server side rendering framework**

## About

Resolute is a TypeScript first (and only at this point) static site generator/server side rendering framework.

It aims to provide an easy to understand interface for building React sites/apps using the latest browser features.

Key features include:

- TypeScript first
- Directory based routing
- Outputs ES modules - no code bundling, faster load times
- Out of the box support for [View Transitions](https://developer.chrome.com/docs/web-platform/view-transitions/)
- Load only relevant modules per page (with caching)
- Control over what is renderer statically, on the server, or the client
- Built-in (optional) support for creating an API
- Preloading of pages - manually and or on hover/focus
- Async components that work on the server _and_ the client
- Intuitive way to group components and apply layouts and context
- Generate pages from markdown files with [react-markdown](https://github.com/remarkjs/react-markdown)
- Easily define metadata for pages (with support for [react-helmet](https://github.com/nfl/react-helmet))
- Styling with [react-jss](https://cssinjs.org/react-jss/)

## ❗️ Pre-text/Warning ❗️

This library is a work in progress. There will be bugs. There will likely be breaking changes.

If you are looking to build a static site using React, then you can already use this to do so, but you may encounter issues with external libraries.

Resolute does not currently support slugs, wildcards, or pagination in routes. These features will be added in the future.

Server side rendering has been temporarily removed to focus on static site generation. It will be re-added in the future.

The dev server has not yet been completed (due to an issue with module resolution in one of our dependencies) so you will need to manually rebuild the site/app after each change, which is not ideal.

## Getting Started

### Project Setup

Create a new directory for your project and navigate to it:

```shell
mkdir my-project
cd my-project
```

Initialize the project (and fill out relevant info):

```shell
npm init
```

Install dependencies:

```shell
npm i @blinkorb/resolute react react-dom react-jss react-helmet typescript @types/react @types/react-dom @types/react-helmet -P
```

Add the following scripts to the `package.json`:

```json
{
  "scripts": {
    "dev": "resolute dev",
    "build": "resolute build"
  }
}
```

Add a type to the `package.json`:

```json
{
  "type": "module"
}
```

You can now run the project with:

```shell
npm run dev
```

The dev server is not yet complete, so you will need to manually rebuild the project after each change.

Open another terminal to rebuild your project with:

```shell
npm run build
```

#### Project Structure

Create a `src` directory in the root of your project. This is where you will put all of your source code.

#### TypeScript Config

You should create a `tsconfig.json` file in the root of your project.

You can use whatever options you like within here, but it _must_ include:

```json
{
  "compilerOptions": {
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "isolatedModules": true,
    "target": "ESNext",
    "module": "NodeNext",
    "jsx": "react"
  },
  "include": ["src"]
}
```

#### Settings

Create a `resolute.settings.tsx` file in the `src` directory and add the following content:

```tsx
import { ResoluteSettings } from '@blinkorb/resolute';

const settings: ResoluteSettings = {
  helmet: {
    defaultTitle: 'Example Title',
    titleTemplate: '%s | Example',
  },
};

export default settings;
```

Inspect the `ResoluteSettings` interface to see what options are available.

### Pages/Directories

To create your home page create an `index.page.tsx` file in the `src` directory and add the following content:

```tsx
import React from 'react';

export const title = 'Home';

const Home = () => <h1>This is the home page</h1>;

export default Home;
```

Any files with `.page.tsx` will be output as a page.

The directory structure will be used to create your routes.

Files beginning with `index` resolve to an empty path, so the `/src/index.page.tsx` will result in a page at `/`.

Example:

```
/src/
  /index.page.tsx
  /about.page.tsx
  /contact/index.page.tsx
```

Will result in the following HTML output:

```
/index.html
/about/index.html
/contact/index.html
```

Any `*.page.tsx` files can be rendered statically, on the server, or on the client. Even if they use hooks, or are an async component.

If you only want a page to be rendered as static HTML or on the server you can name it `whatever.static.tsx` or `whatever.server.tsx` respectively.

If you have a static/server side rendered page you can also define a client side component to hydrate it with by creating a `whatever.client.tsx` file.

Example:

```
/src/
  # Outputs a static HTML page
  /index.static.tsx
  # Is rendered on the server
  /about.server.tsx
  # Is used to hydrate the server-side rendered HTML
  /about.client.tsx
```

If your client side code renders something that does not match the server/static HTML you will get a warning in the console.

If you'd like to avoid hydration and instead render the client side components regardless of what was rendered on the server you can simply `export const hydrate = false;` from your client file.

Note: avoiding hydration will result in slower renders as none of the DOM nodes are recycled.

### Async Components

Resolute supports the ability to define asynchronous components that work on the server and the client.

You cannot use hooks within these components, but you can simplify requesting data by using `await`.

Example:

```tsx
const AsyncComponent = async () => {
  const data = await fetch('/something');

  return <div>{data}</div>;
};
```

Although async components _can_ be rendered on the client you should avoid doing so. The time taken to resolve any requests before the element is rendered will likely not be a nice experience for users navigating your site/app.

### Getting/Sharing Props

You can export a `getProps` function from any page.

This function will be resolved, and the result of the function provided to your component.

In addition, any props returned from this function in a `*.static.tsx` or `*.server.tsx` file will also be provided to the `*.client.tsx` equivalent.

Example:

```tsx
interface Props {
  example: string;
}

export const getProps = (): Props => ({
  example: 'example',
});

const MyComponent = ({ example }: Props) => <div>{example}</div>;
```

If a client component also exports a `getProps` function the results of both functions will be merged.

### Metadata

Pages can export metadata that will be used to generate the page's `<head>` content.

Example:

```tsx
export const title = 'Home';
export const ogDescription = 'This is the home page';
```

Would output:

```html
<head>
  <title>Home</title>
  <meta property="og:description" content="This is the home page" />
</head>
```

You can also apply metadata dynamically using [react-helmet](https://github.com/nfl/react-helmet).

Example:

```tsx
import React from 'react';
import { Helmet } from 'react-helmet';

const Example = () => (
  <Helmet>
    <title>Dynamic Title</title>
  </Helmet>
);
```

### Layouts

Create an `index.layout.tsx` file in the `src` directory and add the following content:

```tsx
import React, { PropsWithChildren } from 'react';

const SiteLayout = ({ children }: PropsWithChildren) => (
  <div>
    <p>This is applied to all pages</p>
    {children}
  </div>
);

export default Layout;
```

This `index.layout.tsx` file will be applied to all pages.

If you wanted to apply a layout to the `/about` route you could also create an `about.layout.tsx` file.

Only one layout is resolved per directory depth, so if you have both an `index.layout.tsx` and `about.layout.tsx` in the `src` directory the `index.layout.tsx` will be applied to all pages except those under `/about`.

If you wanted to apply both the main layout and about layout to pages under `/about` you could create an `/about/index.layout.tsx` file.

Example:

```
/src/
  /index.layout.tsx
  # This overrides the main layout for the `/about` route
  /about.layout.tsx
```

```
/src/
  /index.layout.tsx
  /about/
    # This is applied to the `/about` route in addition to the main layout
    /index.layout.tsx
```

### API

Create an `example.api.ts` file in the `src` directory and add the following content:

```ts
export const getExample = async () => ({
  example: 'example',
});
```

This will create one or more API endpoints under `/api/example/`.

Any functions exported from an `*.api.ts` file will be exposed as an API endpoint.

The naming of these functions defines the request method. E.g. `getExample` will be a `GET` request.

These can be accessed in a type-safe way using the `createAPI` function from within your pages.

Warning: this API is not yet stable and will likely change in the future.

Example:

```tsx
import { createAPI } from '@blinkorb/resolute';

const exampleAPI = createAPI<typeof import('./example.api.js')>('/example');

const result = await exampleAPI('getExample');
// result === { example: 'example' }
```

By using the `typeof import()` syntax we can ensure that any requests we make automatically share the types of the functions defined in our `example.api.ts` file.

### Logical Grouping

Files/directories beginning with `_` will not effect the output path. This is useful for logically grouping pages that don't fall under the same route, but should receive the same layout/context.

Example:

```
/src/
  /index.page.tsx
  /_example/
    /about.page.tsx
```

Will result in the following HTML output:

```
/index.html
/about/index.html
```

### Markdown Pages

Create am `example.md` file in the `src` directory and add the following content:

```md
---
title: Markdown
---

This is _markdown_ content
```

Any markdown files in your `src` directory will be output as static HTML pages with [react-markdown](https://github.com/remarkjs/react-markdown).

You can define the metadata for these files with [YAML front matter](https://github.com/ilterra/markdown-yaml-metadata-parser) within the `---` section at the top of the file.

You can define custom components to be used within your markdown files in the `resolute.settings.tsx` file.

Example:

```tsx
import { ResoluteSettings } from '@blinkorb/resolute';
import React from 'react';
import { Components } from 'react-markdown';

const CustomEm: Components['em'] = ({ children }) => (
  <em>Adds a prefix to all "em" elements: {children}</em>
);

const settings: ResoluteSettings = {
  markdown: {
    components: {
      em: CustomEm,
    },
  },
};
```

### Styling

Resolute uses [react-jss](https://cssinjs.org/react-jss/) for styling.

Example:

```tsx
import React from 'react';
import { createUseStyles } from 'react-jss';

const useStyles = createUseStyles({
  example: {
    color: 'red',
  },
});

const Example = () => {
  const classes = useStyles();

  return <div className={classes.example}>Example</div>;
};
```

To define the types for a theme you can create a `jss.d.ts` file anywhere in your `src` directory and add the following content:

```ts
declare global {
  namespace Jss {
    export interface Theme {
      red: string;
    }
  }
}

export {};
```

You can then add the following to your main `index.layout.tsx` to provide the theme to your components:

```tsx
import React, { PropsWithChildren } from 'react';
import { DefaultTheme, ThemeProvider } from 'react-jss';

const THEME = {
  red: '#f00',
} satisfies DefaultTheme;

const SiteLayout = ({ children }: PropsWithChildren) => (
  <ThemeProvider theme={THEME}>
    <div>
      <p>This is applied to all pages</p>
      {children}
    </div>
  </ThemeProvider>
);

export default Layout;
```

Now you can use this theme in your components:

```tsx
import React from 'react';
import { createUseStyles } from 'react-jss';

const useStyles = createUseStyles((theme) => ({
  example: {
    color: theme.red,
  },
}));

const Example = () => {
  const classes = useStyles();

  return <div className={classes.example}>Example</div>;
};
```

### Links and Preloading

Resolute provides a `Link` component that you should use for _all_ links - this is used by the client side code to make static pages work like a single page app.

You can specify which pages should be preloaded by adding a `preload` prop to your `Link` components, but by default any links will be preloaded on hover/focus. This is customizable via the `resolute.settings.tsx` file.

Example:

```tsx
import React from 'react';
import { Link } from '@blinkorb/resolute';

const Example = () => (
  <div>
    <Link to="/about" preload>
      About
    </Link>
    <Link to="/contact">Contact</Link>
  </div>
);
```

### Hooks

#### useIsClientRender

Returns `true` if this is a subsequent client side render.

It initially returns `false` so that your first client render can match the server render for hydration.

#### useRouter

Returns `{ router: Router, location: LocationInfo }`.

You can use the `Router` methods `navigate`, `go`, and `back` to navigate programmatically.

#### useLocation

Returns `LocationInfo` - similar to `Location` - see type definition for more info.

#### useSettings

Returns the settings defined in your `resolute.settings.tsx`.

#### usePreload

Returns a function that can be used to preload a page (by href).

Warning: we might not expose this in the future. Please try to use `<Link preload>`.
