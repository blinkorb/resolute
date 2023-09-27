import { ResoluteSettings } from '@blinkorb/resolute/src/types.js';

const settings: ResoluteSettings = {
  helmet: {
    defaultTitle: 'Default Title',
    titleTemplate: '%s | Example',
  },
  viewTransitions: true,
};

export default settings;
