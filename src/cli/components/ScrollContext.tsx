import React, { createContext, useContext } from 'react';

interface ScrollContextValue {
  paused: boolean;
}

export const ScrollContext = createContext<ScrollContextValue>({ paused: false });

export function useScrollPaused(): boolean {
  return useContext(ScrollContext).paused;
}
