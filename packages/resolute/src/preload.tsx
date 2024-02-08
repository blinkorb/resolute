import React, { createContext, ReactNode } from 'react';

import { PreloadFunction } from './types.js';

export const PreloadContext = createContext<PreloadFunction | null>(null);

export const PreloadProvider = ({
  preload,
  children,
}: {
  preload: PreloadFunction;
  children?: ReactNode | readonly ReactNode[];
}) => (
  <PreloadContext.Provider value={preload}>{children}</PreloadContext.Provider>
);

PreloadProvider.displayName = 'ResolutePreloadProvider';
