import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifyToken } from "@/lib/auth";
import NavigationShell from "@/components/NavigationShell";

const inter = Inter({ subsets: ["latin"] });

export const dynamic = 'force-dynamic';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "FarmaNómina | Farmacia Su Salud",
  description: "Sistema de nómina y liquidación para Farmacia Su Salud",
  icons: {
    icon: '/images/01_icono_farmacia_transparente.png',
    shortcut: '/images/01_icono_farmacia_transparente.png',
    apple: '/images/01_icono_farmacia.png',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const user = token ? await verifyToken(token) : null;

  if (!user) {
    return (
      <html lang="es">
        <body className={`${inter.className} min-h-screen bg-slate-950 text-slate-100 antialiased`}>
          {children}
        </body>
      </html>
    );
  }

  return (
    <html lang="es">
      <body className={`${inter.className} min-h-screen bg-muted/20 print:bg-white antialiased`}>
        <NavigationShell user={{ name: user.name, email: user.email }}>
          {children}
        </NavigationShell>
      </body>
    </html>
  );
}
