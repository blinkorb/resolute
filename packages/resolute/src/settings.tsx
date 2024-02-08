import React, { createContext, ReactNode } from 'react';

import { ResoluteSettings } from './types.js';

export const SettingsContext = createContext<ResoluteSettings | null>(null);

export const SettingsProvider = ({
  settings,
  children,
}: {
  settings: ResoluteSettings;
  children?: ReactNode | readonly ReactNode[];
}) => (
  <SettingsContext.Provider value={settings}>
    {children}
  </SettingsContext.Provider>
);

SettingsProvider.displayName = 'ResoluteSettingsProvider';
