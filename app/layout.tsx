import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://upgrade-lens.olando111.chatgpt.site'),
  title: 'Upgrade Lens — Same code. Different behavior.',
  description:
    'Explore real Zod upgrade changes and use TypeSafe Jev to judge their impact on application code.',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    type: 'website',
    title: 'Upgrade Lens — Same code. Different behavior.',
    description:
      'Run the same input through Zod 3 and 4. Let Jev judge whether the change matters to your application.',
    url: 'https://upgrade-lens.olando111.chatgpt.site',
    images: [
      {
        url: 'https://upgrade-lens.olando111.chatgpt.site/og.png',
        alt: 'Upgrade Lens. Same code. Different behavior. Built with Jev.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Upgrade Lens — Same code. Different behavior.',
    description:
      'Three real Zod upgrade changes. Typed decisions from Jev. A small experiment in better dependency reviews.',
    images: ['https://upgrade-lens.olando111.chatgpt.site/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
