import { createContext, useContext, useState, useEffect } from 'react';

var ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  // FIX: Read localStorage inside useState so it sets the correct theme IMMEDIATELY on load
  var [theme, setTheme] = useState(function() {
    try {
      var savedTheme = localStorage.getItem('theme');
      if (savedTheme) {
        return savedTheme;
      }
      // If no save found, check system preference
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    } catch (e) {
      // Fallback
    }
    return 'dark'; // Default
  });

  useEffect(function() {
    // Apply theme to document
    document.documentElement.setAttribute('data-theme', theme);
    
    // Optional: Add class for libraries like Tailwind
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Save to storage whenever theme changes
    localStorage.setItem('theme', theme);
  }, [theme]);

  var toggleTheme = function() {
    setTheme(function(prev) {
      return prev === 'dark' ? 'light' : 'dark';
    });
  };

  var value = {
    theme: theme,
    toggleTheme: toggleTheme,
    isDark: theme === 'dark'
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  var context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export default ThemeContext;