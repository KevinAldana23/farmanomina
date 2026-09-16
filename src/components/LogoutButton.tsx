'use client';

import { useTransition } from 'react';
import { logoutAction } from '@/app/actions/authActions';
import { LogOut, Loader2 } from 'lucide-react';

export default function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  const handleLogout = () => {
    startTransition(async () => {
      await logoutAction();
    });
  };

  return (
    <button
      onClick={handleLogout}
      disabled={isPending}
      className="flex items-center gap-3 w-full px-3 py-2 rounded-md text-slate-400 hover:text-white hover:bg-red-950/40 transition-colors text-sm font-medium disabled:opacity-50"
      title="Cerrar sesión"
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
      ) : (
        <LogOut className="h-4 w-4 text-red-400" />
      )}
      <span>{isPending ? 'Saliendo...' : 'Cerrar Sesión'}</span>
    </button>
  );
}
