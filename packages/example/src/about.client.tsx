import { createAPI } from '@blinkorb/resolute';
import React from 'react';

const fetch =
  createAPI<typeof import('./about.server.js')>('./about.server.js');

export const title = 'About Us';

const About = async () => {
  const data = await fetch('getAboutData');

  return (
    <>
      <h1>About</h1>
      <p>{data.content}</p>
    </>
  );
};

export default About;
