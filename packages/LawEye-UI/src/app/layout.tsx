import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LawEye',
  description: 'Contrôle desktop avec LLM locaux',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}

