import React from 'react';

import CounterClient from '../components/counter-client.js';

const NestedLayout = () => {
  return (
    <>
      <p>{`This page has a layout that extends the base layout. If you see "Hello" above, then it's working`}</p>
      <p>
        {`This page should be at the path "/some-path" and not include "_hidden-route", and the counter below should be functional`}
      </p>
      <CounterClient />
    </>
  );
};

export default NestedLayout;
