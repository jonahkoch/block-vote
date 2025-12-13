'use client';

import { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'default' | 'terminal';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('terminal');

  useEffect(() => {
    // Load theme from localStorage
    const savedTheme = localStorage.getItem('blockVoteTheme') as Theme;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'default' ? 'terminal' : 'default';
    setTheme(newTheme);
    localStorage.setItem('blockVoteTheme', newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div className={theme === 'terminal' ? 'theme-terminal' : 'theme-default'}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
