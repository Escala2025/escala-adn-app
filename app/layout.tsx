/**
 * @fileoverview Layout raíz de la aplicación Escala ADN.
 * Define los metadatos globales, la tipografía y el viewport.
 * Envuelve toda la aplicación en el ProveedorAuth.
 */
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: {
    default: 'Escala ADN',
    template: '%s — Escala ADN',
  },
  description: 'Plataforma corporativa de gestión interna — Escala Consciencia & Negocios BIC SAS',
  applicationName: 'Escala ADN',
  robots: 'noindex, nofollow',
};

export const viewport: Viewport = {
  themeColor: '#042842',
  width: 'device-width',
  initialScale: 1,
};

export default function LayoutRaiz({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className="bg-background">
      <body className={`${inter.variable} font-sans antialiased min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
