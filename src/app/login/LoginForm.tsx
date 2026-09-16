'use client';

import { useState } from 'react';
import { useActionState } from 'react';
import { loginAction, LoginResult } from '../actions/authActions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Mail, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';

export default function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [state, formAction, isPending] = useActionState<LoginResult | null, FormData>(
    loginAction,
    null
  );

  return (
    <form action={formAction} className="space-y-5 text-slate-900">
      {state?.error && (
        <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
          <span>{state.error}</span>
        </div>
      )}

      <div className="space-y-2 text-left">
        <Label htmlFor="email" className="text-sm font-semibold text-slate-700">
          Correo Electrónico
        </Label>
        <div className="relative">
          <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="ejemplo@farmacia.com"
            className="pl-9 h-11 bg-white text-slate-900 border-slate-300 placeholder:text-slate-400 focus-visible:ring-slate-900"
            defaultValue="admin@farmacia.com"
          />
        </div>
      </div>

      <div className="space-y-2 text-left">
        <Label htmlFor="password" className="text-sm font-semibold text-slate-700">
          Contraseña
        </Label>
        <div className="relative">
          <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className="pl-9 pr-10 h-11 bg-white text-slate-900 border-slate-300 placeholder:text-slate-400 focus-visible:ring-slate-900"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
            title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
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
