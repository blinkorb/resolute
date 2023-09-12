import { createAPI } from '@blinkorb/resolute';
import React from 'react';

import AboutInfo from './components/about-info.js';

const fetch =
  createAPI<typeof import('./about.server.js')>('./about.server.js');

export const title = 'About Us';

const About = async () => {
  const data = await fetch('getAboutData');

  return <AboutInfo title="About" content={data.content} />;
};

export default About;
