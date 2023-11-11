import React, { ReactNode } from 'react';

const Layout = ({
  children,
}: {
  children: ReactNode | readonly ReactNode[];
}) => {
  return (
    <>
      <p>Nested Layout</p>
      {children}
    </>
  );
};

export default Layout;
