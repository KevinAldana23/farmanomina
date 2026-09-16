import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { Users, FileText, Settings, Activity, LogOut, Download } from "lucide-react";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifyToken } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";

const inter = Inter({ subsets: ["latin"] });

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "FarmaNómina",
  description: "Sistema de nómina para Farmacia Su Salud",
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
        <body className={`${inter.className} min-h-screen bg-slate-950 text-slate-100`}>
          {children}
        </body>
      </html>
    );
  }

  return (
    <html lang="es">
      <body className={`${inter.className} flex h-screen bg-muted/20 print:bg-white`}>
        {/* Sidebar */}
        <aside className="w-64 bg-slate-900 text-slate-300 flex-shrink-0 flex flex-col justify-between print:hidden">
          <div>
            <div className="h-16 flex items-center px-6 bg-slate-950 font-bold text-white text-lg">
              ⚕️ FarmaNómina
            </div>
            <nav className="py-6 flex flex-col gap-2 px-4">
              <Link href="/" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                <Activity className="h-5 w-5" /> Dashboard
              </Link>
              <Link href="/empleados" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                <Users className="h-5 w-5" /> Colaboradores
              </Link>
              <Link href="/nomina" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                <FileText className="h-5 w-5" /> Liquidar Nómina
              </Link>
              <Link href="/liquidacion" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                <LogOut className="h-5 w-5" /> Liquidación Definitiva
              </Link>
              <Link href="/reportes" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                <Download className="h-5 w-5" /> Reportes y Exportar
              </Link>
              <Link href="/configuracion" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                <Settings className="h-5 w-5" /> Configuración
              </Link>
            </nav>
          </div>

          {/* User profile & Logout */}
          <div className="p-4 border-t border-slate-800 space-y-3">
            <div className="px-2">
              <p className="text-xs font-semibold text-white truncate">{user.name}</p>
              <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
            </div>
            <LogoutButton />
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
