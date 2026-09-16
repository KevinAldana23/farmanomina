import { Metadata } from 'next';
import LoginForm from './LoginForm';

export const metadata: Metadata = {
  title: 'Iniciar Sesión | FarmaNómina',
  description: 'Acceso seguro al sistema de nómina y gestión de empleados de Farmacia Su Salud',
};

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 px-4 py-8 sm:py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-slate-900 border border-slate-800 text-2xl sm:text-3xl mb-3 shadow-md">
            ⚕️
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">FarmaNómina</h1>
          <p className="text-slate-400 text-sm mt-1">
            Portal de gestión privada para Farmacia Su Salud
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-2xl border border-slate-100 text-slate-900">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">Iniciar Sesión</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Ingresa tus credenciales de administradora para continuar
            </p>
          </div>

          <LoginForm />

          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400">
              Sistema protegido y encriptado con seguridad estándar de la industria.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
