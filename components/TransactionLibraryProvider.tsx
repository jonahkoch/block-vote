'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

type TransactionLibrary = 'mesh' | 'lucid';

interface TransactionLibraryContextType {
  library: TransactionLibrary;
  setLibrary: (lib: TransactionLibrary) => void;
  toggleLibrary: () => void;
}

const TransactionLibraryContext = createContext<TransactionLibraryContextType | undefined>(undefined);

export function TransactionLibraryProvider({ children }: { children: ReactNode }) {
  const [library, setLibrary] = useState<TransactionLibrary>('lucid');

  const toggleLibrary = () => {
    setLibrary(prev => prev === 'mesh' ? 'lucid' : 'mesh');
  };

  return (
    <TransactionLibraryContext.Provider value={{ library, setLibrary, toggleLibrary }}>
      {children}
    </TransactionLibraryContext.Provider>
  );
}

export function useTransactionLibrary() {
  const context = useContext(TransactionLibraryContext);
  if (!context) {
    throw new Error('useTransactionLibrary must be used within TransactionLibraryProvider');
  }
  return context;
}
