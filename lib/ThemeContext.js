import React from 'react';

export const ThemeContext = React.createContext();

export function ThemeProvider({ children }) {
  const [darkMode, setDarkMode] = React.useState(false);

  const toggleDarkMode = React.useCallback(() => {
    setDarkMode((prev) => !prev);
  }, []);

  const value = React.useMemo(
    () => ({
      darkMode,
      setDarkMode,
      toggleDarkMode,
    }),
    [darkMode, toggleDarkMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
