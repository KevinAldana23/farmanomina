'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { 
  Users, 
  FileText, 
  Settings, 
  Activity, 
  LogOut as LogOutIcon, 
  Download, 
  Menu, 
  X,
  ShieldCheck
} from 'lucide-react';
import LogoutButton from '@/components/LogoutButton';

interface UserInfo {
  name: string;
  email: string;
}

interface NavigationShellProps {
  user: UserInfo;
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: Activity },
  { href: '/empleados', label: 'Colaboradores', icon: Users },
  { href: '/nomina', label: 'Liquidar Nómina', icon: FileText },
  { href: '/liquidacion', label: 'Liquidación Definitiva', icon: LogOutIcon },
  { href: '/auditoria', label: 'Auditoría CST', icon: ShieldCheck },
  { href: '/reportes', label: 'Reportes y Exportar', icon: Download },
  { href: '/configuracion', label: 'Configuración', icon: Settings },
];

export default function NavigationShell({ user, children }: NavigationShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const [prevPathname, setPrevPathname] = useState(pathname);

  // Close mobile menu when pathname changes during render
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setMobileMenuOpen(false);
  }

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  return (
    <div className="flex flex-col md:flex-row min-h-screen w-full bg-muted/20 print:bg-white">
      {/* ── Top Bar for Mobile / Small Screens ── */}
      <header className="md:hidden sticky top-0 z-40 flex items-center justify-between h-16 px-4 bg-slate-950 text-white border-b border-slate-800 print:hidden shadow-sm">
        <Link href="/" className="flex items-center gap-2.5 font-bold text-lg text-white">
          <Image
            src="/images/01_icono_farmacia_transparente.png"
            alt="Farmacia Su Salud"
            width={28}
            height={28}
            className="w-7 h-7 object-contain rounded-md"
          />
          <div className="flex flex-col">
            <span className="text-sm leading-tight font-bold tracking-tight">FarmaNómina</span>
            <span className="text-[10px] text-orange-400 font-medium leading-none">Farmacia Su Salud</span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 max-w-[120px] truncate hidden sm:inline-block">
            {user.name}
          </span>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(prev => !prev)}
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
            aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </header>

      {/* ── Backdrop Overlay for Mobile Drawer ── */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs md:hidden animate-in fade-in duration-200"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile Slide-Over Drawer ── */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-slate-900 text-slate-300 flex flex-col justify-between shadow-2xl transition-transform duration-300 ease-in-out md:hidden ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          <div className="h-16 flex items-center justify-between px-4 bg-slate-950 border-b border-slate-800">
            <Link href="/" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2.5">
              <Image
                src="/images/01_icono_farmacia_transparente.png"
                alt="Farmacia Su Salud"
                width={32}
                height={32}
                className="w-8 h-8 object-contain rounded-lg"
              />
              <div className="flex flex-col">
                <span className="text-sm leading-tight font-bold tracking-tight text-white">FarmaNómina</span>
                <span className="text-[10px] text-orange-400 font-medium leading-none">Farmacia Su Salud</span>
              </div>
            </Link>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
              aria-label="Cerrar menú"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="py-4 flex flex-col gap-1.5 px-4 overflow-y-auto max-h-[calc(100vh-210px)]">
            {NAV_ITEMS.map(item => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${
                    isActive 
                      ? 'bg-slate-800 text-white font-semibold shadow-xs' 
                      : 'hover:bg-slate-800/70 hover:text-white text-slate-300'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div>
          {/* Logo badge in mobile drawer */}
          <div className="px-4 pb-2">
            <div className="rounded-lg bg-slate-950/70 border border-slate-800 p-2 flex items-center justify-center">
              <Image
                src="/images/02_logo_horizontal_transparente.png"
                alt="Farmacia Su Salud"
                width={180}
                height={40}
                className="w-full h-auto object-contain max-h-9"
              />
            </div>
          </div>

          {/* User profile & Logout inside mobile drawer */}
          <div className="p-4 border-t border-slate-800 space-y-3 bg-slate-950/60">
            <div className="px-2">
              <p className="text-sm font-semibold text-white truncate">{user.name}</p>
              <p className="text-xs text-slate-400 truncate">{user.email}</p>
            </div>
            <LogoutButton />
          </div>
        </div>
      </div>

      {/* ── Desktop Sidebar (Permanent) ── */}
      <aside className="hidden md:flex md:w-64 bg-slate-900 text-slate-300 flex-shrink-0 flex-col justify-between print:hidden min-h-screen">
        <div>
          <div className="h-20 flex items-center px-4 bg-slate-950 border-b border-slate-800/80">
            <Link href="/" className="flex items-center gap-3 group w-full">
              <div className="w-10 h-10 shrink-0 rounded-xl bg-slate-900 border border-slate-800 p-1 flex items-center justify-center transition-transform group-hover:scale-105 shadow-sm">
                <Image
                  src="/images/01_icono_farmacia_transparente.png"
                  alt="Farmacia Su Salud"
                  width={34}
                  height={34}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-white text-base tracking-tight leading-tight group-hover:text-emerald-400 transition-colors">
                  FarmaNómina
                </span>
                <span className="text-[11px] text-orange-400 font-medium tracking-wide truncate">
                  Farmacia Su Salud
                </span>
              </div>
            </Link>
          </div>
          <nav className="py-6 flex flex-col gap-1.5 px-4">
            {NAV_ITEMS.map(item => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-sm ${
                    isActive 
                      ? 'bg-slate-800 text-white font-semibold' 
                      : 'hover:bg-slate-800 hover:text-white text-slate-300'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div>
          {/* Logo badge in sidebar */}
          <div className="px-4 py-2">
            <div className="rounded-xl bg-slate-950/70 border border-slate-800/80 p-2.5 flex items-center justify-center">
              <Image
                src="/images/02_logo_horizontal_transparente.png"
                alt="Farmacia Su Salud"
                width={200}
                height={45}
                className="w-full h-auto object-contain max-h-10 opacity-90 hover:opacity-100 transition-opacity"
              />
            </div>
          </div>

          {/* User profile & Logout */}
          <div className="p-4 border-t border-slate-800 space-y-3">
            <div className="px-2">
              <p className="text-xs font-semibold text-white truncate">{user.name}</p>
              <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
            </div>
            <LogoutButton />
          </div>
        </div>
      </aside>

      {/* ── Main Content Area ── */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
