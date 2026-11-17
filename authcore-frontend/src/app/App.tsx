import React from 'react';
import { BrowserRouter } from 'react-router-dom';

import { ThemeProvider } from '@/app/theme';
import { AuthProvider } from '@/context/AuthContext';
import { AppRouter } from '@/router';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
};

export default App;
