import React, { ReactNode } from 'react';

const Layout = ({
  children,
}: {
  children: ReactNode | readonly ReactNode[];
}) => {
  return (
    <>
      <p>Hello</p>
      {children}
    </>
  );
};

export default Layout;
