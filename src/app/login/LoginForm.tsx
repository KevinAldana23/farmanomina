'use client';

import { useActionState } from 'react';
import { loginAction, LoginResult } from '../actions/authActions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Mail, AlertCircle, Loader2 } from 'lucide-react';

export default function LoginForm() {
  const [state, formAction, isPending] = useActionState<LoginResult | null, FormData>(
    loginAction,
    null
  );

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && (
        <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
          <span>{state.error}</span>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm font-semibold text-slate-700">
          Correo Electrónico
        </Label>
        <div className="relative">
          <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="ejemplo@farmacia.com"
            className="pl-9 h-11"
            defaultValue="admin@farmacia.com"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-sm font-semibold text-slate-700">
          Contraseña
        </Label>
        <div className="relative">
          <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className="pl-9 h-11"
          />
        </div>
      </div>

      <Button
        type="submit"
        disabled={isPending}
        className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm transition-all"
      >
        {isPending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Iniciando sesión...
          </>
        ) : (
          'Entrar al Sistema'
        )}
      </Button>
    </form>
  );
}
