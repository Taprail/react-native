import { createContext } from 'react';
import type { TaprailClient } from '../client/TaprailClient';

export interface TaprailContextValue {
  client: TaprailClient;
}

export const TaprailContext = createContext<TaprailContextValue | null>(null);
