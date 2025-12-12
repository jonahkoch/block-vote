'use client';

import { MeshProvider } from '@meshsdk/react';

export function CardanoProvider({ children }: { children: React.ReactNode }) {
  return (
    <MeshProvider>
      {children}
    </MeshProvider>
  );
}
