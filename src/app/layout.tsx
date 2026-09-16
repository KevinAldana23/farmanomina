import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { Users, FileText, Settings, Activity, LogOut, Download } from "lucide-react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FarmaNómina",
  description: "Sistema de nómina para Farmacia Su Salud",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${inter.className} flex h-screen bg-muted/20 print:bg-white`}>
        {/* Sidebar */}
        <aside className="w-64 bg-slate-900 text-slate-300 flex-shrink-0 flex flex-col print:hidden">
          <div className="h-16 flex items-center px-6 bg-slate-950 font-bold text-white text-lg">
            ⚕️ FarmaNómina
          </div>
          <nav className="flex-1 py-6 flex flex-col gap-2 px-4">
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
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
