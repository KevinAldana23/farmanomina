import { Metadata } from 'next';
import Image from 'next/image';
import LoginForm from './LoginForm';

export const metadata: Metadata = {
  title: 'Iniciar Sesión | FarmaNómina - Farmacia Su Salud',
  description: 'Acceso seguro al sistema de nómina y gestión de empleados de Farmacia Su Salud',
};

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 px-4 py-8 sm:py-12 relative overflow-hidden">
      {/* Subtle background glow effects using pharmacy theme colors */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-6 sm:mb-8 flex flex-col items-center">
          {/* Logo container with brand styling */}
          <div className="relative group mb-3">
            <div className="absolute -inset-1 bg-gradient-to-r from-orange-500/30 to-blue-600/30 rounded-2xl blur-xs opacity-75 group-hover:opacity-100 transition duration-500" />
            <div className="relative rounded-xl overflow-hidden shadow-2xl border border-slate-800 bg-slate-900/90 p-2 sm:p-2.5 max-w-[340px] sm:max-w-[380px]">
              <Image
                src="/images/02_logo_horizontal.png"
                alt="Farmacia Su Salud - Sistema de Nómina y Liquidación"
                width={380}
                height={95}
                priority
                className="w-full h-auto object-contain rounded-lg"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2 mt-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
              Sistema de Nómina y Gestión Laboral
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-2xl border border-slate-100 text-slate-900">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Iniciar Sesión</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Ingresa tus credenciales de administradora para continuar
            </p>
          </div>

          <LoginForm />

          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400">
              Farmacia Su Salud • Sistema protegido y encriptado.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
