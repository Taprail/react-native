import { useContext } from 'react';
import { TaprailContext, type TaprailContextValue } from '../provider/TaprailContext';

/**
 * Access the TaprailClient instance from context.
 * Must be used within a `<TaprailProvider>`.
 */
export function useTaprail(): TaprailContextValue {
  const context = useContext(TaprailContext);
  if (!context) {
    throw new Error(
      'useTaprail must be used within a <TaprailProvider>. ' +
      'Wrap your component tree with <TaprailProvider apiKey="..." tier="...">.',
    );
  }
  return context;
}
