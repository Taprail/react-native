import React, { useMemo, type ReactNode } from 'react';
import type { TaprailConfig } from '../types';
import { TaprailClient } from '../client/TaprailClient';
import { TaprailContext, type TaprailContextValue } from './TaprailContext';

export interface TaprailProviderProps extends TaprailConfig {
  children: ReactNode;
}

export function TaprailProvider({
  children,
  ...config
}: TaprailProviderProps) {
  const value = useMemo<TaprailContextValue>(() => {
    const client = new TaprailClient(config);
    return { client };
  }, [config.apiKey, config.tier, config.baseUrl, config.timeout]);

  return (
    <TaprailContext.Provider value={value}>
      {children}
    </TaprailContext.Provider>
  );
}
