import { ResoluteSettings } from '@blinkorb/resolute';
import React from 'react';
import { createUseStyles } from 'react-jss';
import { Components } from 'react-markdown';

const useStyles = createUseStyles((theme) => ({
  em: {
    color: theme.blue,
  },
}));

const Italic: Components['em'] = ({ children }) => {
  const styles = useStyles();

  return <em className={styles.em}>{children}</em>;
};

const settings: ResoluteSettings = {
  helmet: {
    defaultTitle: 'Default Title',
    titleTemplate: '%s | Example',
  },
  markdown: {
    components: {
      em: Italic,
    },
  },
};

export default settings;
