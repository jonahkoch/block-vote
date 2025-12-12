'use client';

import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useTransactionLibrary } from './TransactionLibraryProvider';

export function NavigationMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { library, toggleLibrary } = useTransactionLibrary();

  return (
    <>
      {/* Hamburger Button - Center Position (visible on all screens) */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed left-1/2 -translate-x-1/2 top-4 z-40 px-4 py-2 bg-gray-500/20 backdrop-blur-sm border-2 border-gray-500 text-gray-500 dark:text-gray-400 font-mono font-bold rounded hover:bg-gray-500/30 transition-colors"
        aria-label="Open navigation menu"
      >
        [ ☰ MENU ]
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Navigation Drawer - Drops down from top */}
      <div
        className={`fixed left-0 right-0 top-0 max-h-screen overflow-y-auto bg-white dark:bg-gray-900 shadow-xl z-50 transition-transform duration-300 ${
          isOpen ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <div className="flex flex-col">
          {/* Header */}
          <div className="terminal-header flex items-center justify-between p-4 border-b-2 border-gray-700">
            <span>┌─ MENU</span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 font-bold text-xl"
              aria-label="Close menu"
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="max-w-4xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Theme Toggle */}
                <div className="terminal-box-double">
                  <div className="terminal-header">┌─ THEME</div>
                  <div className="p-3">
                    <button
                      onClick={() => {
                        toggleTheme();
                        setIsOpen(false);
                      }}
                      className="w-full px-4 py-3 border-2 border-green-500 text-green-500 font-mono font-bold rounded hover:bg-green-500/20 transition-colors text-center"
                    >
                      {theme === 'default' ? '[ TERMINAL MODE ]' : '[ DEFAULT MODE ]'}
                    </button>
                    <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 font-mono text-center">
                      Current: {theme === 'default' ? 'Default' : 'Terminal'}
                    </div>
                  </div>
                </div>

                {/* Transaction Library Toggle */}
                <div className="terminal-box-double">
                  <div className="terminal-header">┌─ TX LIBRARY</div>
                  <div className="p-3">
                    <button
                      onClick={() => {
                        toggleLibrary();
                      }}
                      className="w-full px-4 py-3 border-2 border-purple-500 text-purple-500 dark:text-purple-400 font-mono font-bold rounded hover:bg-purple-500/20 transition-colors text-center flex items-center justify-center gap-2"
                    >
                      <span className="text-xs">TX LIB:</span>
                      <span className="font-extrabold">{library.toUpperCase()}</span>
                      {library === 'lucid' && <span className="text-green-400">🚀</span>}
                    </button>
                    <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 font-mono text-center">
                      {library === 'mesh' ? 'Using Mesh SDK' : 'Using Lucid Evolution'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Navigation Links */}
              <div className="terminal-box-double mt-4">
                <div className="terminal-header">┌─ NAVIGATE</div>
                <div className="p-3 space-y-2">
                  <a
                    href="/diagnostics"
                    className="block w-full px-4 py-3 border-2 border-blue-500 text-blue-500 font-mono font-bold rounded hover:bg-blue-500/20 transition-colors text-center"
                    onClick={() => setIsOpen(false)}
                  >
                    [ MESH SDK DIAGNOSTICS ]
                  </a>
                </div>
              </div>

              {/* Info Box */}
              <div className="terminal-box-double mt-4">
                <div className="terminal-header">┌─ INFO</div>
                <div className="p-3 text-xs text-gray-600 dark:text-gray-400 font-mono">
                  <p className="mb-2">
                    └─ Use <span className="text-blue-500">[ WALLET ]</span> to connect
                  </p>
                  <p>
                    └─ Use <span className="text-purple-500">[ CLAIM PACT ]</span> for membership
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t-2 border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-600 font-mono text-center">
              └─ blockVote Navigation
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
