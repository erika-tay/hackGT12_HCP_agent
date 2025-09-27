'use client';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { CedarCopilot, ProviderConfig } from 'cedar-os';
import { messageRenderers } from '@/cedar/messageRenderers';
import { EmailApp } from './EmailApp';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <EmailApp>
          {children}
        </EmailApp>
      </body>
    </html>
  );
}
