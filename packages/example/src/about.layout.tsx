import React, { ReactNode } from 'react';

import BaseLayout from './index.layout.js';

const Layout = ({
  children,
}: {
  children: ReactNode | readonly ReactNode[];
}) => (
  <BaseLayout>
    <p>This layout overrides the base layout</p>
    {children}
  </BaseLayout>
);

export default Layout;
