import './global.css';
import { RootProvider } from 'fumadocs-ui/provider';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import { Body } from './layout.client';

const inter = Inter({
  subsets: ['latin'],
});

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <head>
        <link rel="icon" href="/icon.svg" sizes='any' type="image/svg+xml" />
      </head>
      <Body>
        <RootProvider>{children}</RootProvider>
      </Body>
    </html>
  );
}

