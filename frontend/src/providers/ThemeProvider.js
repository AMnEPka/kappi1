import React, { createContext, useContext, useState, useEffect } from 'react';
import { material3LightTheme, material3DarkTheme } from '../styles/themes/material3';
import '../styles/material3.css';

const ThemeContext = createContext();

export const ThemeProvider = ({ children, defaultTheme = 'light' }) => {
  const [theme, setTheme] = useState(defaultTheme);
  
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
  }, [theme]);
  
  const currentTheme = theme === 'dark' ? material3DarkTheme : material3LightTheme;
  
  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };
  
  return (
    <ThemeContext.Provider value={{ theme: currentTheme, themeMode: theme, toggleTheme }}>
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