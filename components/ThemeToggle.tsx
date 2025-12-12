'use client';

import { useTheme } from '@/contexts/ThemeContext';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="fixed top-4 left-1/2 -translate-x-1/2 px-4 py-2 border-2 border-green-500 rounded bg-green-500/20 hover:bg-green-500/30 transition-colors z-50 font-mono text-green-500"
      title="Toggle theme"
    >
      {theme === 'default' ? (
        <span>[ TERMINAL MODE ]</span>
      ) : (
        <span>[ DEFAULT MODE ]</span>
      )}
    </button>
  );
}
