import React, { ReactNode } from 'react';

const Layout = ({
  children,
}: {
  children: ReactNode | readonly ReactNode[];
}) => {
  return (
    <>
      <p>Nested Layout in Hidden Route</p>
      {children}
    </>
  );
};

export default Layout;
