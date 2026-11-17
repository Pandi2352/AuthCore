import React from 'react';
import { Outlet } from 'react-router-dom';

import { Navbar } from './Navbar';

export const Layout: React.FC = () => {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />
      <main className="mx-auto w-full max-w-(--content-max-width) flex-1 px-4 py-page sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
};
