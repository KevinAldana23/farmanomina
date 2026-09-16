import Image from 'next/image';
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Activity, FileText } from 'lucide-react';

export default async function DashboardPage() {
  const employeesCount = await prisma.employee.count({ 
    where: { 
      isActive: true, 
      finalLiquidation: null 
    } 
  });
  
  const inactivesCount = await prisma.employee.count({ 
    where: { 
      OR: [
        { isActive: false },
        { finalLiquidation: { isNot: null } }
      ]
    } 
  });

  const liquidationsCount = await prisma.finalLiquidation.count();
  const recentLiquidations = await prisma.finalLiquidation.findMany({
    take: 3,
    orderBy: { terminationDate: 'desc' },
    include: { employee: true }
  });

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8">
      {/* Pharmacy Corporate Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 p-6 sm:p-7 shadow-xl">
        <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-5 pointer-events-none flex items-center justify-end overflow-hidden pr-6">
          <Image
            src="/images/01_icono_farmacia_transparente.png"
            alt=""
            width={240}
            height={240}
            className="object-contain"
          />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-800/80 border border-slate-700/60 p-2 shadow-inner flex items-center justify-center shrink-0">
              <Image
                src="/images/01_icono_farmacia_transparente.png"
                alt="Logo Farmacia Su Salud"
                width={56}
                height={56}
                priority
                className="w-full h-full object-contain drop-shadow"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/30">
                  Farmacia Su Salud
                </span>
                <span className="text-xs text-slate-400 hidden sm:inline">• Sistema de Nómina y Liquidación</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1.5">
                ¡Bienvenida a FarmaNómina!
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
                Panel integral de nómina, liquidación de personal y reportes con normativa legal colombiana vigente.
              </p>
            </div>
          </div>

          <div className="hidden lg:flex items-center shrink-0">
            <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-2 shadow-lg">
              <Image
                src="/images/02_logo_horizontal_transparente.png"
                alt="Farmacia Su Salud"
                width={220}
                height={55}
                className="h-11 w-auto object-contain"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Empleados Activos</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employeesCount}</div>
            <p className="text-xs text-muted-foreground">Listos para nómina regular</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Retirados (Histórico)</CardTitle>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inactivesCount}</div>
            <p className="text-xs text-muted-foreground">
              {liquidationsCount > 0 
                ? `${liquidationsCount} con liquidación definitiva` 
                : 'Colaboradores inactivos'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Estado del Sistema</CardTitle>
            <FileText className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">Al Día</div>
            <p className="text-xs text-muted-foreground">Parámetros 2026 cargados</p>
          </CardContent>
        </Card>
      </div>

      {recentLiquidations.length > 0 && (
        <Card className="border-red-100 bg-red-50/30">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <span>🔒</span> Últimas Liquidaciones Definitivas Registradas
              </CardTitle>
              <a href="/liquidacion" className="text-xs text-red-600 hover:text-red-700 font-medium hover:underline self-start sm:self-auto">
                Ver todas en Liquidación →
              </a>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {recentLiquidations.map((liq) => (
                <div key={liq.id} className="bg-white border rounded-lg p-3 text-sm space-y-1 shadow-sm">
                  <div className="flex justify-between items-start">
                    <span className="font-semibold text-slate-800">{liq.employee.name}</span>
                    <span className="text-xs bg-red-100 text-red-700 font-medium px-1.5 py-0.5 rounded">Liquidado</span>
                  </div>
                  <p className="text-xs text-slate-500">{liq.employee.position}</p>
                  <div className="flex justify-between pt-1 border-t text-xs text-slate-600">
                    <span>Fecha Retiro:</span>
                    <span>{new Date(liq.terminationDate).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold text-slate-900">
                    <span>Total:</span>
                    <span>{formatCurrency(liq.netPay)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mt-8 bg-blue-50 border border-blue-100 p-4 sm:p-6 rounded-lg text-blue-900">

        <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
          💡 Tips de Uso Rápido
        </h3>
        <ul className="list-disc pl-5 space-y-2 text-sm">
          <li>Ve a <strong>Colaboradores</strong> para registrar a tu personal o actualizar salarios.</li>
          <li>Usa <strong>Liquidar Nómina</strong> cada quincena o mes para contrastar los cálculos de tu contadora usando el <em>Módulo de Auditoría</em> incluido al final de esa página.</li>
          <li>Si un empleado renuncia, entra a <strong>Liquidación Definitiva</strong> para saber exactamente cuánto le debes pagar por cesantías, primas y vacaciones proporcionales.</li>
        </ul>
      </div>
    </div>
  );
}
