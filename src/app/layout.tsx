import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { AccountBadge } from './account-badge';

export const metadata: Metadata = {
  title: 'Leader Resolver',
  description: 'Resolve company leaders from domains via the DataForSEO SERP API',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="top">
          <div className="inner">
            <h1>Leader Resolver</h1>
            <Link href="/" className="small">Runs</Link>
            <Link href="/admin" className="small">Admin</Link>
            <span className="spacer" />
            <AccountBadge />
          </div>
        </header>
        <main className="wrap">{children}</main>
      </body>
    </html>
  );
}
