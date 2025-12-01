import React, { createContext, useContext } from 'react';
import { yellowBlackTheme } from '../styles/themes/yellow-black';

const ThemeContext = createContext();

export const ThemeProvider = ({ children, theme = yellowBlackTheme }) => {
  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};