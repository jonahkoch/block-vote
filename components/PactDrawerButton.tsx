'use client';

import { useState } from 'react';
import ClaimPactDrawer from './ClaimPactDrawer';

export function PactDrawerButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* CLAIM PACT Button - Fixed Position (far right) */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed right-2 md:right-4 top-4 z-40 px-4 py-2 bg-purple-500/20 backdrop-blur-sm border-2 border-purple-500 text-purple-500 dark:text-purple-400 font-mono font-bold rounded hover:bg-purple-500/30 transition-colors"
      >
        [ CLAIM PACT ]
      </button>

      {/* Claim PACT Drawer */}
      <ClaimPactDrawer isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
