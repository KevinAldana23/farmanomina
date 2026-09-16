'use client';

import { useState, useMemo, useCallback } from 'react';
import Image from 'next/image';

import { Employee, LegalConfig } from '@prisma/client';
import { calculatePayroll, PayrollNovedades, LegalConfig as ParsedConfig } from '@/lib/payrollEngine';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import AuditSection from './AuditSection';
import { savePayrollPeriodAction } from '../actions/savePayrollAction';


const MONTHS = [
  { value: "1", label: "Enero" },
  { value: "2", label: "Febrero" },
  { value: "3", label: "Marzo" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Mayo" },
  { value: "6", label: "Junio" },
  { value: "7", label: "Julio" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" },
];

export default function PayrollCalculator({ employees, configs }: { employees: Employee[], configs: LegalConfig[] }) {
  const now = new Date();
  const currentYear = now.getFullYear();
  // Rango dinámico automático: desde 2024 hasta 10 años en el futuro
  const startYear = 2024;
  const endYear = Math.max(currentYear + 5, 2035);
  const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => String(startYear + i));

  const [selectedEmpId, setSelectedEmpId] = useState<string>(employees[0]?.id || '');
  const [selectedMonth, setSelectedMonth] = useState<string>(String(now.getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState<string>(String(currentYear));
  const [periodType, setPeriodType] = useState<'q1' | 'q2' | 'month'>('q1');
  
  const isQuincenal = periodType !== 'month';
  const monthNum = Number(selectedMonth);
  const yearNum = Number(selectedYear);
  const lastDay = new Date(yearNum, monthNum, 0).getDate();

  const startDate = periodType === 'q2' 
    ? `${selectedYear}-${selectedMonth.padStart(2, '0')}-16`
    : `${selectedYear}-${selectedMonth.padStart(2, '0')}-01`;

  const endDate = periodType === 'q1'
    ? `${selectedYear}-${selectedMonth.padStart(2, '0')}-15`
    : `${selectedYear}-${selectedMonth.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const monthName = MONTHS.find(m => m.value === selectedMonth)?.label || '';
  const periodLabel = periodType === 'q1' 
    ? `${monthName} ${selectedYear} - 1ra Quincena (1 al 15)`
    : periodType === 'q2'
    ? `${monthName} ${selectedYear} - 2da Quincena (16 al ${lastDay})`
    : `${monthName} ${selectedYear} - Mes Completo`;

  // Diccionario para guardar las novedades de cada empleado individualmente
  const [novedadesMap, setNovedadesMap] = useState<Record<string, PayrollNovedades>>({});
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const selectedEmp = employees.find(e => e.id === selectedEmpId);

  // Novedades por defecto según el periodo (15 o 30 días)
  const defaultNovedades: PayrollNovedades = useMemo(() => ({
    daysWorked: isQuincenal ? 15 : 30,
    extraHoursDiurna: 0,
    extraHoursNocturna: 0,
    recargoNocturnoHours: 0,
    dominicalFestivoDiurnoHours: 0,
    dominicalFestivoNocturnoHours: 0,
    extraDiurnaDominicalFestivoHours: 0,
    extraNocturnaDominicalFestivoHours: 0,
    otherIncomes: 0,
    otherDeductions: 0
  }), [isQuincenal]);

  // Novedades del empleado actual (memorizadas)
  const currentNovedades = useMemo(() => {
    return novedadesMap[selectedEmpId] || defaultNovedades;
  }, [novedadesMap, selectedEmpId, defaultNovedades]);

  const activeConfig = useMemo(() => {
    const eDate = new Date(endDate);
    const cfg = configs.find(c => new Date(c.validFrom) <= eDate);
    return cfg || configs[configs.length - 1];
  }, [endDate, configs]);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

  const result = useMemo(() => {
    if (!selectedEmp || !activeConfig) return null;
    const parsedConfig: ParsedConfig = {
      validFrom: activeConfig.validFrom.toString(),
      configData: JSON.parse(activeConfig.configData)
    };
    return calculatePayroll({
      baseSalary: selectedEmp.baseSalary,
      isIntegralSalary: selectedEmp.isIntegralSalary,
      arlRiskClass: selectedEmp.arlRiskClass,
      hireDate: selectedEmp.hireDate.toString(),
    }, currentNovedades, parsedConfig);
  }, [selectedEmp, currentNovedades, activeConfig]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNovedadesMap(prev => ({
      ...prev,
      [selectedEmpId]: {
        ...(prev[selectedEmpId] || currentNovedades),
        [name]: Number(value) || 0
      }
    }));
  };

  const handlePeriodTypeChange = (val: string | null) => {
    const newType = (val as 'q1' | 'q2' | 'month') || 'q1';
    setPeriodType(newType);
    const defaultDays = newType === 'month' ? 30 : 15;
    setNovedadesMap(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(id => {
        if (updated[id].daysWorked === 15 || updated[id].daysWorked === 30) {
          updated[id] = { ...updated[id], daysWorked: defaultDays };
        }
      });
      return updated;
    });
  };

  const isEmployeeModified = useCallback((empId: string) => {
    const nov = novedadesMap[empId];
    if (!nov) return false;
    const defaultDays = isQuincenal ? 15 : 30;
    return (
      nov.daysWorked !== defaultDays ||
      nov.extraHoursDiurna > 0 ||
      nov.extraHoursNocturna > 0 ||
      nov.recargoNocturnoHours > 0 ||
      nov.dominicalFestivoDiurnoHours > 0 ||
      nov.dominicalFestivoNocturnoHours > 0 ||
      nov.extraDiurnaDominicalFestivoHours > 0 ||
      nov.extraNocturnaDominicalFestivoHours > 0 ||
      nov.otherIncomes > 0 ||
      nov.otherDeductions > 0
    );
  }, [novedadesMap, isQuincenal]);

  const modifiedCount = useMemo(() => {
    return employees.filter(emp => isEmployeeModified(emp.id)).length;
  }, [employees, isEmployeeModified]);



  if (employees.length === 0 || !selectedEmp) {
    return (
      <Card className="p-8 text-center text-slate-500">
        No hay colaboradores activos registrados para liquidar nómina.
      </Card>
    );
  }


  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 print:block">
      {/* Columna Izquierda: Novedades */}
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>Ingreso de Novedades</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4 mb-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Empleado</Label>
                {modifiedCount > 0 ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    {modifiedCount} de {employees.length} con novedades
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    0 de {employees.length} con novedades
                  </span>
                )}
              </div>
              <Select value={selectedEmpId} onValueChange={(val) => setSelectedEmpId(val || '')}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona...">
                    {selectedEmp ? `${selectedEmp.name} - ${selectedEmp.position}` : "Selecciona..."}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {employees.map(emp => {
                    const hasMod = isEmployeeModified(emp.id);
                    return (
                      <SelectItem key={emp.id} value={emp.id}>
                        <div className="flex items-center justify-between w-full gap-2">
                          <span>{emp.name} - {emp.position}</span>
                          {hasMod && (
                            <span className="text-[10px] bg-amber-100 text-amber-800 font-semibold px-1.5 py-0.2 rounded ml-2">
                              Modificado
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Mes</Label>
                <Select value={selectedMonth} onValueChange={(val) => setSelectedMonth(val || '1')}>
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {MONTHS.find(m => m.value === selectedMonth)?.label}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Año</Label>
                <Select value={selectedYear} onValueChange={(val) => setSelectedYear(val || String(currentYear))}>
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {selectedYear}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(y => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Periodo a Liquidar</Label>
                <Select value={periodType} onValueChange={handlePeriodTypeChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {periodType === 'q1' 
                        ? '1ra Quincena (1 al 15)' 
                        : periodType === 'q2' 
                        ? '2da Quincena (16 al fin)' 
                        : 'Mes Completo (1 al 30)'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="q1">1ra Quincena (1 al 15)</SelectItem>
                    <SelectItem value="q2">2da Quincena (16 al fin)</SelectItem>
                    <SelectItem value="month">Mes Completo (1 al 30)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="text-xs bg-blue-50 text-blue-800 px-3 py-2 rounded-md border border-blue-200 flex flex-wrap items-center justify-between gap-1">
              <span>Periodo activo: <strong>{periodLabel}</strong></span>
              <span className="font-mono text-blue-600">({startDate} al {endDate})</span>
            </div>
          </div>
          
          {/* Sección de Días Trabajados */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="space-y-1 col-span-1">
              <Label className="text-sm font-semibold text-slate-700">Días Trabajados</Label>
              <Input 
                type="number" 
                name="daysWorked" 
                value={currentNovedades.daysWorked || ''} 
                placeholder="0"
                onChange={handleChange} 
                min="0" 
                max="30" 
              />
              <span className="text-[11px] text-muted-foreground">Base (máx 30)</span>
            </div>
          </div>

          {/* Horas Ordinarias (Lunes a Sábado) */}
          <div className="pt-2 border-t">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Semana Ordinaria (Lunes a Sábado)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Horas Extra Diurnas (+25%)</Label>
                <Input 
                  type="number" 
                  name="extraHoursDiurna" 
                  value={currentNovedades.extraHoursDiurna || ''} 
                  placeholder="0"
                  onChange={handleChange} 
                  min="0" 
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Horas Extra Nocturnas (+75%)</Label>
                <Input 
                  type="number" 
                  name="extraHoursNocturna" 
                  value={currentNovedades.extraHoursNocturna || ''} 
                  placeholder="0"
                  onChange={handleChange} 
                  min="0" 
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Recargos Nocturnos (+35%)</Label>
                <Input 
                  type="number" 
                  name="recargoNocturnoHours" 
                  value={currentNovedades.recargoNocturnoHours || ''} 
                  placeholder="0"
                  onChange={handleChange} 
                  min="0" 
                />
              </div>
            </div>
          </div>

          {/* Domingos y Festivos */}
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                Domingos y Festivos
              </h4>
              <span className="text-[11px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded">
                Turnos vs Extras
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1 bg-amber-50/40 p-2.5 rounded border border-amber-100">
                <Label className="text-xs font-medium text-amber-950">Turno Dom/Festivo Diurno</Label>
                <Input 
                  type="number" 
                  name="dominicalFestivoDiurnoHours" 
                  value={currentNovedades.dominicalFestivoDiurnoHours || ''} 
                  placeholder="0"
                  onChange={handleChange} 
                  min="0" 
                />
                <p className="text-[10px] text-muted-foreground">Turno normal en domingo (solo recargo)</p>
              </div>

              <div className="space-y-1 bg-amber-50/40 p-2.5 rounded border border-amber-100">
                <Label className="text-xs font-medium text-amber-950">Turno Dom/Festivo Nocturno</Label>
                <Input 
                  type="number" 
                  name="dominicalFestivoNocturnoHours" 
                  value={currentNovedades.dominicalFestivoNocturnoHours || ''} 
                  placeholder="0"
                  onChange={handleChange} 
                  min="0" 
                />
                <p className="text-[10px] text-muted-foreground">Turno domingo noche (recargo noct + festivo)</p>
              </div>

              <div className="space-y-1 bg-rose-50/40 p-2.5 rounded border border-rose-100">
                <Label className="text-xs font-medium text-rose-950">⭐ Extra Diurna Dom/Festivo</Label>
                <Input 
                  type="number" 
                  name="extraDiurnaDominicalFestivoHours" 
                  value={currentNovedades.extraDiurnaDominicalFestivoHours || ''} 
                  placeholder="0"
                  onChange={handleChange} 
                  min="0" 
                />
                <p className="text-[10px] text-muted-foreground">Hora extra en domingo (2.15x)</p>
              </div>

              <div className="space-y-1 bg-rose-50/40 p-2.5 rounded border border-rose-100">
                <Label className="text-xs font-medium text-rose-950">⭐ Extra Nocturna Dom/Festivo</Label>
                <Input 
                  type="number" 
                  name="extraNocturnaDominicalFestivoHours" 
                  value={currentNovedades.extraNocturnaDominicalFestivoHours || ''} 
                  placeholder="0"
                  onChange={handleChange} 
                  min="0" 
                />
                <p className="text-[10px] text-muted-foreground">Hora extra domingo noche (2.65x)</p>
              </div>
            </div>
          </div>

          {/* Otros Ingresos y Deducciones */}
          <div className="pt-2 border-t">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Ajustes y Novedades Monetarias
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Otros Ingresos ($)</Label>
                <Input 
                  type="number" 
                  name="otherIncomes" 
                  value={currentNovedades.otherIncomes || ''} 
                  placeholder="0"
                  onChange={handleChange} 
                  min="0" 
                />
                <span className="text-[10px] text-muted-foreground">Bonos, comisiones</span>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Otras Deducciones ($)</Label>
                <Input 
                  type="number" 
                  name="otherDeductions" 
                  value={currentNovedades.otherDeductions || ''} 
                  placeholder="0"
                  onChange={handleChange} 
                  min="0" 
                />
                <span className="text-[10px] text-muted-foreground">Adelantos, faltantes</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Columna Derecha: Desprendible interactivo */}
      {result && (
        <Card className="bg-slate-50 border-emerald-100 print:shadow-none print:border-none print:bg-white print:col-span-2">
          <CardHeader className="bg-emerald-50/50 pb-4 border-b print:bg-white print:border-b-2 print:border-black">
            {/* Pharmacy Branding Header on Payslip */}
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-emerald-200/60 print:border-slate-300">
              <div className="flex items-center gap-2.5">
                <Image
                  src="/images/01_icono_farmacia_transparente.png"
                  alt="Farmacia Su Salud"
                  width={36}
                  height={36}
                  className="w-9 h-9 object-contain rounded"
                />
                <div>
                  <h3 className="font-bold text-sm sm:text-base tracking-tight text-slate-900 leading-tight">FARMACIA SU SALUD</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Comprobante Oficial de Nómina</p>
                </div>
              </div>
              <div className="hidden sm:flex items-center print:flex">
                <Image
                  src="/images/02_logo_horizontal_transparente.png"
                  alt="Farmacia Su Salud"
                  width={160}
                  height={36}
                  className="h-7 w-auto object-contain print:h-8"
                />
              </div>
            </div>

            <CardTitle className="text-emerald-800 text-base sm:text-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:text-black pt-2">
              <span className="truncate">Desprendible de Pago - {selectedEmp.name}</span>
              <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                <span className="font-bold text-base sm:text-lg">{formatCurrency(result.netPay)} Neto</span>
                <button 
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-md text-xs sm:text-sm hover:bg-emerald-700 print:hidden flex items-center gap-1.5 transition-colors"
                  title="Imprimir Desprendible"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="14" y="14" width="12" height="8"></rect></svg>
                  <span>Imprimir</span>
                </button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6 text-sm print:text-black">
            <div>
              <h4 className="font-semibold text-slate-700 mb-2 border-b pb-1">Devengado</h4>
              <div className="flex justify-between py-1">
                <span>Salario Básico ({currentNovedades.daysWorked} días)</span>
                <span>{formatCurrency(result.devengado.basicSalaryPeriod)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Auxilio de Transporte</span>
                <span>{formatCurrency(result.devengado.auxilioTransporte)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Recargos y Extras</span>
                <span className="font-medium">{formatCurrency(result.devengado.totalRecargos)}</span>
              </div>
              {result.devengado.totalRecargos > 0 && (
                <div className="ml-3 my-1 pl-2 border-l-2 border-slate-200 text-xs text-slate-600 space-y-0.5">
                  {currentNovedades.extraHoursDiurna > 0 && (
                    <div className="flex justify-between">
                      <span>• Extra Diurna ({currentNovedades.extraHoursDiurna}h @ 1.25x):</span>
                      <span>{formatCurrency(result.devengado.recargos.extraDiurna)}</span>
                    </div>
                  )}
                  {currentNovedades.extraHoursNocturna > 0 && (
                    <div className="flex justify-between">
                      <span>• Extra Nocturna ({currentNovedades.extraHoursNocturna}h @ 1.75x):</span>
                      <span>{formatCurrency(result.devengado.recargos.extraNocturna)}</span>
                    </div>
                  )}
                  {currentNovedades.recargoNocturnoHours > 0 && (
                    <div className="flex justify-between">
                      <span>• Recargo Nocturno ({currentNovedades.recargoNocturnoHours}h @ 0.35x):</span>
                      <span>{formatCurrency(result.devengado.recargos.recargoNocturno)}</span>
                    </div>
                  )}
                  {currentNovedades.dominicalFestivoDiurnoHours > 0 && (
                    <div className="flex justify-between text-amber-800">
                      <span>• Turno Dom/Festivo ({currentNovedades.dominicalFestivoDiurnoHours}h @ {((activeConfig ? JSON.parse(activeConfig.configData).recargosYExtras.dominicalFestivoDiurno : 0.9) * 100).toFixed(0)}% recargo):</span>
                      <span>{formatCurrency(result.devengado.recargos.dominicalFestivoDiurno)}</span>
                    </div>
                  )}
                  {currentNovedades.dominicalFestivoNocturnoHours > 0 && (
                    <div className="flex justify-between text-amber-800">
                      <span>• Turno Dom Nocturno ({currentNovedades.dominicalFestivoNocturnoHours}h @ recargo):</span>
                      <span>{formatCurrency(result.devengado.recargos.dominicalFestivoNocturno)}</span>
                    </div>
                  )}
                  {currentNovedades.extraDiurnaDominicalFestivoHours > 0 && (
                    <div className="flex justify-between font-semibold text-rose-700">
                      <span>• ⭐ Extra Diurna Dom/Festivo ({currentNovedades.extraDiurnaDominicalFestivoHours}h @ 2.15x):</span>
                      <span>{formatCurrency(result.devengado.recargos.extraDiurnaDominicalFestivo)}</span>
                    </div>
                  )}
                  {currentNovedades.extraNocturnaDominicalFestivoHours > 0 && (
                    <div className="flex justify-between font-semibold text-rose-700">
                      <span>• ⭐ Extra Nocturna Dom/Festivo ({currentNovedades.extraNocturnaDominicalFestivoHours}h @ 2.65x):</span>
                      <span>{formatCurrency(result.devengado.recargos.extraNocturnaDominicalFestivo)}</span>
                    </div>
                  )}
                </div>
              )}
              {currentNovedades.otherIncomes > 0 && (
                <div className="flex justify-between py-1">
                  <span>Otros Ingresos</span>
                  <span>{formatCurrency(result.devengado.otherIncomes)}</span>
                </div>
              )}
              <div className="flex justify-between py-1 font-bold pt-2 border-t mt-1">
                <span>Total Devengado</span>
                <span>{formatCurrency(result.devengado.totalDevengado)}</span>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-slate-700 mb-2 border-b pb-1">Deducciones</h4>
              <div className="flex justify-between py-1">
                <span>Salud (4%)</span>
                <span className="text-red-600">-{formatCurrency(result.deducciones.salud)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Pensión (4%)</span>
                <span className="text-red-600">-{formatCurrency(result.deducciones.pension)}</span>
              </div>
              {result.deducciones.fsp > 0 && (
                <div className="flex justify-between py-1">
                  <span>Fondo Solidaridad</span>
                  <span className="text-red-600">-{formatCurrency(result.deducciones.fsp)}</span>
                </div>
              )}
              {currentNovedades.otherDeductions > 0 && (
                <div className="flex justify-between py-1">
                  <span>Otras Deducciones</span>
                  <span className="text-red-600">-{formatCurrency(result.deducciones.otherDeductions)}</span>
                </div>
              )}
              <div className="flex justify-between py-1 font-bold pt-2 border-t mt-1">
                <span>Total Deducciones</span>
                <span className="text-red-600">-{formatCurrency(result.deducciones.totalDeducciones)}</span>
              </div>
            </div>
            
            <div className="bg-slate-100 p-3 rounded-md text-xs space-y-1">
              <h4 className="font-semibold text-slate-600 mb-1">Costos Empleador (Info)</h4>
              <div className="flex justify-between text-slate-500">
                <span>Total Seguridad Social (Salud, Pensión, ARL, etc)</span>
                <span>{formatCurrency(result.employer.totalAportes)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Provisiones (Prima, Cesantías, Vacaciones)</span>
                <span>{formatCurrency(result.employer.totalProvisiones)}</span>
              </div>
              <div className="flex justify-between font-semibold text-slate-700 pt-1 mt-1 border-t">
                <span>Costo Total Empresa</span>
                <span>{formatCurrency(result.employer.costoTotal)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {result && (
        <div className="lg:col-span-2 print:hidden space-y-4">
          <AuditSection 
            calculatedNetPay={result.netPay}
            calculatedSocial={result.employer.totalAportes + result.deducciones.salud + result.deducciones.pension + result.deducciones.fsp}
            exonerated={result.employer.aportes.salud === 0}
          />

          <Card className="mt-8 bg-blue-50 border-blue-200 print:hidden">
            <CardHeader>
              <CardTitle className="text-blue-800 flex items-center justify-between">
                Guardar Nómina
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-blue-800 mb-4">
                Al guardar, se consolidará la nómina de los <strong>{employees.length} empleados activos</strong>
                {modifiedCount > 0 
                  ? ` (${modifiedCount} con novedades personalizadas y ${employees.length - modifiedCount} con periodo estándar)`
                  : ' (todos con periodo estándar sin horas extras)'
                }. Esta nómina quedará registrada y lista en Reportes.
              </p>
              <Button 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 text-lg"
                onClick={() => setIsSaveDialogOpen(true)}
                disabled={isSaving}
              >
                💾 Guardar Periodo Completo
              </Button>
            </CardContent>
          </Card>

          {/* Diálogo de Confirmación para Guardar Nómina */}
          <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
            <DialogContent className="w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6">
              <DialogHeader>
                <DialogTitle>¿Confirmar guardado de nómina?</DialogTitle>
                <DialogDescription className="pt-2 text-slate-600 space-y-2">
                  <span>
                    Estás a punto de consolidar y guardar la nómina de <strong>{employees.length} colaboradores activos</strong> para el periodo:
                  </span>
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-md font-semibold text-blue-900 mt-2 text-center">
                    {periodLabel}
                    <div className="text-xs font-normal text-blue-700 mt-0.5">
                      ({startDate} al {endDate})
                    </div>
                  </div>
                  {modifiedCount > 0 ? (
                    <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                      ℹ <strong>{modifiedCount}</strong> colaborador{modifiedCount !== 1 ? 'es tienen' : ' tiene'} novedades personalizadas guardadas.
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Todos los colaboradores se liquidarán con periodo estándar sin novedades adicionales.
                    </p>
                  )}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="sm:justify-end mt-4">
                <Button type="button" variant="outline" onClick={() => setIsSaveDialogOpen(false)} disabled={isSaving}>
                  Cancelar
                </Button>
                <Button 
                  type="button" 
                  className="bg-blue-600 hover:bg-blue-700 text-white" 
                  disabled={isSaving}
                  onClick={async () => {
                    setIsSaving(true);
                    try {
                      await savePayrollPeriodAction({
                        startDate,
                        endDate,
                        isQuincenal,
                        novedadesMap
                      });
                      setIsSaveDialogOpen(false);
                      alert('¡Nómina guardada exitosamente! Ya puedes verla y exportarla en el módulo de Reportes.');
                    } catch (err) {
                      console.error(err);
                      alert('Error al guardar la nómina.');
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                >
                  {isSaving ? 'Guardando...' : 'Confirmar y Guardar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}

