'use client';

import { useTransactionLibrary } from './TransactionLibraryProvider';

export function LibraryToggle() {
  const { library, toggleLibrary } = useTransactionLibrary();

  return (
    <div className="fixed left-44 top-4 z-40">
      <button
        onClick={toggleLibrary}
        className="px-4 py-2 bg-purple-500/20 backdrop-blur-sm border-2 border-purple-500 text-purple-500 dark:text-purple-400 font-mono font-bold rounded hover:bg-purple-500/30 transition-colors flex items-center gap-2"
        title="Toggle between Mesh SDK and Lucid Evolution"
      >
        <span className="text-xs">TX LIB:</span>
        <span className="font-extrabold">{library.toUpperCase()}</span>
        {library === 'lucid' && <span className="text-green-400">🚀</span>}
      </button>
      <div className="text-xs text-gray-500 dark:text-gray-600 font-mono text-center mt-1">
        {library === 'mesh' ? 'Using Mesh SDK' : 'Using Lucid Evolution'}
      </div>
    </div>
  );
}
