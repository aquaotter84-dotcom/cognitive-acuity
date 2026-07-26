import { createContext, useContext } from 'react';

export const CognosContext = createContext(null);

export function useCognos() {
  return useContext(CognosContext);
}