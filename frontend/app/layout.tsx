import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Decision-Flow PM',
  description: 'Decision-first project management MVP',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
