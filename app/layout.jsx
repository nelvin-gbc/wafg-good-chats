import './globals.css';
import { Archivo_Black, Inter, Caveat } from 'next/font/google';

const archivo = Archivo_Black({ weight: '400', subsets: ['latin'], variable: '--font-display' });
const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const caveat = Caveat({ weight: ['500', '700'], subsets: ['latin'], variable: '--font-script' });

export const metadata = {
  title: 'spread good rooms · we are for good',
  description: 'good chats. five minutes at a time.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${archivo.variable} ${inter.variable} ${caveat.variable}`}>
      <body>{children}</body>
    </html>
  );
}
