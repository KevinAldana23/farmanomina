'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  ShieldCheck, 
  FileText, 
  Search, 
  Download, 
  CheckCircle2, 
  Sparkles, 
  Eye, 
  Printer, 
  History
} from 'lucide-react';
import * as xlsx from 'xlsx';

// ── Tipos de datos ─────────────────────────────────────────────────────────

export interface AuditLiquidationItem {
  id: string;
  employeeId: string;
  terminationDate: Date | string;
  reason: string;
  baseSalary: number;
  totalSeverance: number;
  totalInterests: number;
  totalPremium: number;
  totalVacations: number;
  totalIndemnity: number;
  netPay: number;
  calculations: string;
  employee: {
    id: string;
    document: string;
    name: string;
    position: string;
    hireDate: Date | string;
    contractType: string;
  };
}

export interface AuditPayrollRecord {
  id: string;
  periodId: string;
  daysWorked: number;
  novedades: string;
  totalDevengado: number;
  totalDeducciones: number;
  netPay: number;
  employerCost: number;
  calculations: string;
  period: {
    id: string;
    startDate: Date | string;
    endDate: Date | string;
    isQuincenal: boolean;
    status: string;
  };
}

export interface AuditEmployee {
  id: string;
  document: string;
  name: string;
  position: string;
  hireDate: Date | string;
  terminationDate: Date | string | null;
  contractType: string;
  baseSalary: number;
  isActive: boolean;
  finalLiquidation: {
    id: string;
    terminationDate: Date | string;
    netPay: number;
    reason: string;
  } | null;
  payrollRecords: AuditPayrollRecord[];
}

interface ParsedLiquidationCalc {
  pendingSalary?: {
    basic: number;
    transport: number;
    salud: number;
    pension: number;
    netPending: number;
  };
  benefits?: {
    severance: number;
    interests: number;
    premium: number;
    vacations: number;
    pendingVacationDays: number;
  };
  basesUsed?: {
    severanceBase: number;
    premiumBase: number;
    vacationBase: number;
    appliesTransport: boolean;
  };
  customBasesApplied?: {
    severanceBase: number;
    premiumBase: number;
    vacationBase: number;
  };
  historicalSummary?: {
    hasHistory: boolean;
    periodsEvaluatedYear: number;
    periodsEvaluatedSemester: number;
    breakdown: {
      totalNightSurchargesYear: number;
      averageMonthlyNightSurcharges: number;
      totalRecargosYear: number;
      averageMonthlyVariableSeverance: number;
      totalCommissionsYear: number;
    };
  };
  indemnity?: number;
  netPay?: number;
}

const REASON_LABELS: Record<string, string> = {
  renuncia: 'Renuncia Voluntaria',
  fin_contrato: 'Fin de Contrato (Fijo)',
  despido_con_justa_causa: 'Despido Con Justa Causa',
  despido_sin_justa_causa: 'Despido Sin Justa Causa',
};

const MONTHS = [
  { value: 'all', label: 'Todos los meses' },
  { value: '1', label: 'Enero' },
  { value: '2', label: 'Febrero' },
  { value: '3', label: 'Marzo' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Mayo' },
  { value: '6', label: 'Junio' },
  { value: '7', label: 'Julio' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
];

interface PayrollNovedadesData {
  daysWorked?: number;
  extraDiurnaHours?: number;
  extraNocturnaHours?: number;
  dominicalFestivoHours?: number;
  dominicalFestivoNocturnoHours?: number;
  extraDiurnaDominicalFestivoHours?: number;
  extraNocturnaDominicalFestivoHours?: number;
  otherIncomes?: number;
  otherDeductions?: number;
}

interface PayrollCalculationsData {
  devengado?: {
    basicSalaryPeriod?: number;
    auxilioTransporte?: number;
    recargos?: {
      recargoNocturno?: number;
      recargoDominical?: number;
      recargoDominicalNocturno?: number;
      extraDiurna?: number;
      extraNocturna?: number;
      extraDominicalDiurna?: number;
      extraDominicalNocturna?: number;
    };
    totalRecargos?: number;
    otherIncomes?: number;
    totalDevengado?: number;
  };
  deducciones?: {
    salud?: number;
    pension?: number;
    otherDeductions?: number;
    totalDeducciones?: number;
  };
  netPay?: number;
}

export default function AuditDashboard({
  liquidations,
  employees,
}: {
  liquidations: AuditLiquidationItem[];
  employees: AuditEmployee[];
}) {
  const currentYearStr = new Date().getFullYear().toString();
  const [activeTab, setActiveTab] = useState<'liquidaciones' | 'nominas'>('liquidaciones');

  // Formateadores estándar
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val || 0);

  const formatDate = (d: Date | string) =>
    new Date(d).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });

  // ══════════════════════════════════════════════════════════════════════════
  // ESTADOS Y FILTROS: TAB 1 (LIQUIDACIONES)
  // ══════════════════════════════════════════════════════════════════════════
  const [liqYear, setLiqYear] = useState<string>(currentYearStr);
  const [liqMonth, setLiqMonth] = useState<string>('all');
  const [liqReason, setLiqReason] = useState<string>('all');
  const [liqSearch, setLiqSearch] = useState<string>('');
  const [selectedLiquidation, setSelectedLiquidation] = useState<AuditLiquidationItem | null>(null);

  // Años disponibles en liquidaciones (garantiza rango multianual + años con registros)
  const liquidationYears = useMemo(() => {
    const years = new Set<string>();
    const currentYear = new Date().getFullYear();
    // Ofrecer rango histórico estándar (últimos 5 años y próximo año)
    for (let y = currentYear + 1; y >= currentYear - 5; y--) {
      years.add(y.toString());
    }
    liquidations.forEach(l => {
      const y = new Date(l.terminationDate).getFullYear().toString();
      years.add(y);
    });
    return Array.from(years).sort().reverse();
  }, [liquidations]);

  // Liquidaciones filtradas
  const filteredLiquidations = useMemo(() => {
    return liquidations.filter(l => {
      const d = new Date(l.terminationDate);
      const matchYear = liqYear === 'all' || d.getFullYear().toString() === liqYear;
      const monthNum = (d.getMonth() + 1).toString();
      const matchMonth = liqMonth === 'all' || monthNum === liqMonth;
      const matchReason = liqReason === 'all' || l.reason === liqReason;
      const matchSearch = !liqSearch.trim() || 
        l.employee.name.toLowerCase().includes(liqSearch.toLowerCase()) ||
        l.employee.document.includes(liqSearch.trim());

      return matchYear && matchMonth && matchReason && matchSearch;
    });
  }, [liquidations, liqYear, liqMonth, liqReason, liqSearch]);

  // KPIs de Liquidaciones
  const liqMetrics = useMemo(() => {
    const totalCases = filteredLiquidations.length;
    const totalNet = filteredLiquidations.reduce((acc, curr) => acc + curr.netPay, 0);
    const totalBenefits = filteredLiquidations.reduce((acc, curr) => 
      acc + curr.totalSeverance + curr.totalInterests + curr.totalPremium + curr.totalVacations, 0);
    const totalIndemnity = filteredLiquidations.reduce((acc, curr) => acc + curr.totalIndemnity, 0);

    return { totalCases, totalNet, totalBenefits, totalIndemnity };
  }, [filteredLiquidations]);

  // Exportar liquidaciones a Excel
  const handleExportLiquidationsExcel = () => {
    const rows = filteredLiquidations.map(l => {
      let parsedCalc: ParsedLiquidationCalc = {};
      try {
        parsedCalc = JSON.parse(l.calculations);
      } catch {
        // ignora
      }
      return {
        'Cédula': l.employee.document,
        'Colaborador': l.employee.name,
        'Cargo': l.employee.position,
        'Fecha Retiro': new Date(l.terminationDate).toLocaleDateString('es-CO'),
        'Motivo Retiro': REASON_LABELS[l.reason] ?? l.reason,
        'Salario Básico': l.baseSalary,
        'Base Cesantías (Art. 253)': parsedCalc.basesUsed?.severanceBase || l.baseSalary,
        'Base Prima (Art. 306)': parsedCalc.basesUsed?.premiumBase || l.baseSalary,
        'Base Vacaciones (Art. 192)': parsedCalc.basesUsed?.vacationBase || l.baseSalary,
        'Cesantías': l.totalSeverance,
        'Intereses Cesantías': l.totalInterests,
        'Prima de Servicios': l.totalPremium,
        'Vacaciones': l.totalVacations,
        'Indemnización Art. 64': l.totalIndemnity,
        'Total Liquidado': l.netPay,
      };
    });

    const ws = xlsx.utils.json_to_sheet(rows);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Auditoria_Liquidaciones');
    xlsx.writeFile(wb, `Auditoria_Liquidaciones_${liqYear !== 'all' ? liqYear : 'Historico'}.xlsx`);
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ESTADOS Y FILTROS: TAB 2 (NÓMINAS POR EMPLEADO)
  // ══════════════════════════════════════════════════════════════════════════
  const [selectedEmpId, setSelectedEmpId] = useState<string>(employees[0]?.id || '');
  const [payYear, setPayYear] = useState<string>(currentYearStr);
  const [payMonth, setPayMonth] = useState<string>('all');
  const [selectedPayrollRecord, setSelectedPayrollRecord] = useState<AuditPayrollRecord | null>(null);

  const selectedEmployee = useMemo(() => {
    return employees.find(e => e.id === selectedEmpId) || employees[0] || null;
  }, [employees, selectedEmpId]);

  // Años disponibles para las nóminas (garantiza rango multianual, ingresos de empleados y registros)
  const payrollYears = useMemo(() => {
    const years = new Set<string>();
    const currentYear = new Date().getFullYear();
    // Ofrecer rango histórico estándar (últimos 5 años y próximo año)
    for (let y = currentYear + 1; y >= currentYear - 5; y--) {
      years.add(y.toString());
    }
    employees.forEach(emp => {
      if (emp.hireDate) {
        years.add(new Date(emp.hireDate).getFullYear().toString());
      }
      emp.payrollRecords.forEach(r => {
        const y = new Date(r.period.startDate).getFullYear().toString();
        years.add(y);
      });
    });
    return Array.from(years).sort().reverse();
  }, [employees]);

  // Nóminas filtradas del empleado seleccionado
  const filteredPayrollRecords = useMemo(() => {
    if (!selectedEmployee) return [];
    return selectedEmployee.payrollRecords.filter(r => {
      const d = new Date(r.period.startDate);
      const matchYear = payYear === 'all' || d.getFullYear().toString() === payYear;
      const monthNum = (d.getMonth() + 1).toString();
      const matchMonth = payMonth === 'all' || monthNum === payMonth;
      return matchYear && matchMonth;
    });
  }, [selectedEmployee, payYear, payMonth]);

  // Métricas acumuladas del empleado en el periodo
  const empAccumulatedMetrics = useMemo(() => {
    let totalDevengado = 0;
    let totalNetPay = 0;
    let totalDeducciones = 0;
    let totalOvertimePay = 0;
    let totalOvertimeHours = 0;
    let totalNightSurcharges = 0;
    let totalCommissions = 0;
    let totalDaysWorked = 0;

    filteredPayrollRecords.forEach(r => {
      totalDevengado += r.totalDevengado;
      totalNetPay += r.netPay;
      totalDeducciones += r.totalDeducciones;
      totalDaysWorked += r.daysWorked;

      try {
        const calc = JSON.parse(r.calculations);
        const nov = JSON.parse(r.novedades || '{}');
        const dev = calc.devengado || {};
        const rec = dev.recargos || {};

        // Horas extras
        const otPay = (Number(rec.extraDiurna) || 0) + 
                      (Number(rec.extraNocturna) || 0) + 
                      (Number(rec.extraDominicalDiurna) || 0) + 
                      (Number(rec.extraDominicalNocturna) || 0);
        const otHours = (Number(nov.extraDiurnaHours) || 0) + 
                        (Number(nov.extraNocturnaHours) || 0) + 
                        (Number(nov.extraDiurnaDominicalFestivoHours) || 0) + 
                        (Number(nov.extraNocturnaDominicalFestivoHours) || 0);

        totalOvertimePay += otPay;
        totalOvertimeHours += otHours;

        // Recargos ordinarios (nocturno 35% y dominical 75%)
        const nightSurch = (Number(rec.recargoNocturno) || 0) + (Number(rec.recargoDominical) || 0) + (Number(rec.recargoDominicalNocturno) || 0);
        totalNightSurcharges += nightSurch;

        // Comisiones / otros ingresos
        totalCommissions += Number(dev.otherIncomes) || 0;
      } catch {
        // continúa
      }
    });

    return {
      totalDevengado,
      totalNetPay,
      totalDeducciones,
      totalOvertimePay,
      totalOvertimeHours,
      totalNightSurcharges,
      totalCommissions,
      totalDaysWorked,
      totalPeriods: filteredPayrollRecords.length
    };
  }, [filteredPayrollRecords]);

  // Exportar historial de nóminas a Excel
  const handleExportPayrollExcel = () => {
    if (!selectedEmployee) return;
    const rows = filteredPayrollRecords.map(r => {
      let calc: PayrollCalculationsData = {};
      let nov: PayrollNovedadesData = {};
      try {
        calc = JSON.parse(r.calculations);
        nov = JSON.parse(r.novedades || '{}');
      } catch {
        // ignora
      }

      const dev = calc.devengado || {};
      const rec = dev.recargos || {};
      const ded = calc.deducciones || {};

      return {
        'Periodo Inicio': new Date(r.period.startDate).toLocaleDateString('es-CO'),
        'Periodo Fin': new Date(r.period.endDate).toLocaleDateString('es-CO'),
        'Días Trabajados': r.daysWorked,
        'Básico Periodo': dev.basicSalaryPeriod || 0,
        'H. Extras Diurnas (Hrs)': nov.extraDiurnaHours || 0,
        'H. Extras Nocturnas (Hrs)': nov.extraNocturnaHours || 0,
        'H. Extras Festivas (Hrs)': (nov.extraDiurnaDominicalFestivoHours || 0) + (nov.extraNocturnaDominicalFestivoHours || 0),
        'Total $ Horas Extras': (rec.extraDiurna || 0) + (rec.extraNocturna || 0) + (rec.extraDominicalDiurna || 0) + (rec.extraDominicalNocturna || 0),
        'Recargo Nocturno (35%)': rec.recargoNocturno || 0,
        'Recargo Dominical/Festivo': (rec.recargoDominical || 0) + (rec.recargoDominicalNocturno || 0),
        'Comisiones / Bonificaciones': dev.otherIncomes || 0,
        'Auxilio Transporte': dev.auxilioTransporte || 0,
        'Total Devengado': r.totalDevengado,
        'Deducción Salud': ded.salud || 0,
        'Deducción Pensión': ded.pension || 0,
        'Otras Deducciones': ded.otherDeductions || 0,
        'Total Deducciones': r.totalDeducciones,
        'Neto Pagado': r.netPay
      };
    });

    const ws = xlsx.utils.json_to_sheet(rows);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Historial_Nominas');
    xlsx.writeFile(wb, `Nominas_${selectedEmployee.name.replace(/\s+/g, '_')}_${payYear !== 'all' ? payYear : 'Historico'}.xlsx`);
  };

  return (
    <div className="space-y-8">
      {/* ── Encabezado y Selector de Pestaña Principal ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-blue-600" />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Módulo de Auditoría y Casos</h1>
          </div>
          <p className="text-sm sm:text-base text-slate-500 mt-1">
            Supervisa el cumplimiento del Código Sustantivo del Trabajo (CST), trazabilidad de liquidaciones y novedades de nómina por colaborador.
          </p>
        </div>

        {/* Selector de Pestañas */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('liquidaciones')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'liquidaciones'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Liquidaciones Definitivas</span>
            <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 font-bold">
              {liquidations.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('nominas')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'nominas'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Nóminas por Colaborador</span>
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* PESTAÑA 1: AUDITORÍA DE LIQUIDACIONES DEFINITIVAS                    */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'liquidaciones' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Barra de Filtros */}
          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-4 sm:p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 items-end">
                {/* Año */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Año de Retiro</Label>
                  <Select value={liqYear} onValueChange={(val) => setLiqYear(val || 'all')}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Año">
                        {liqYear === 'all' ? 'Todos los años' : liqYear}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los años</SelectItem>
                      {liquidationYears.map(y => (
                        <SelectItem key={y} value={y}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Mes */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Mes de Retiro</Label>
                  <Select value={liqMonth} onValueChange={(val) => setLiqMonth(val || 'all')}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Mes">
                        {MONTHS.find(m => m.value === liqMonth)?.label ?? 'Mes'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Motivo */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Motivo</Label>
                  <Select value={liqReason} onValueChange={(val) => setLiqReason(val || 'all')}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Motivo">
                        {liqReason === 'all' ? 'Todos los motivos' : (REASON_LABELS[liqReason] ?? liqReason)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los motivos</SelectItem>
                      {Object.entries(REASON_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Búsqueda */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Buscar Colaborador</Label>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <Input
                      placeholder="Nombre o Cédula..."
                      value={liqSearch}
                      onChange={(e) => setLiqSearch(e.target.value)}
                      className="pl-9 bg-white"
                    />
                  </div>
                </div>

                {/* Exportar */}
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleExportLiquidationsExcel}
                    disabled={filteredLiquidations.length === 0}
                    className="w-full bg-white border-slate-300 hover:bg-slate-50 flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4 text-emerald-600" />
                    <span>Exportar Excel</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tarjetas de Métricas de Liquidación */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card className="border-blue-100 bg-blue-50/40">
              <CardContent className="p-4">
                <span className="text-xs text-blue-700 font-semibold uppercase tracking-wider">Casos Auditados</span>
                <p className="text-2xl font-bold text-blue-900 mt-1">{liqMetrics.totalCases}</p>
                <p className="text-[11px] text-blue-600 mt-0.5">En el periodo seleccionado</p>
              </CardContent>
            </Card>

            <Card className="border-emerald-100 bg-emerald-50/40">
              <CardContent className="p-4">
                <span className="text-xs text-emerald-700 font-semibold uppercase tracking-wider">Total Liquidado</span>
                <p className="text-2xl font-bold text-emerald-900 mt-1">{formatCurrency(liqMetrics.totalNet)}</p>
                <p className="text-[11px] text-emerald-600 mt-0.5">Desembolso final neto</p>
              </CardContent>
            </Card>

            <Card className="border-purple-100 bg-purple-50/40">
              <CardContent className="p-4">
                <span className="text-xs text-purple-700 font-semibold uppercase tracking-wider">Prestaciones Sociales</span>
                <p className="text-2xl font-bold text-purple-900 mt-1">{formatCurrency(liqMetrics.totalBenefits)}</p>
                <p className="text-[11px] text-purple-600 mt-0.5">Cesantías + Prima + Vacaciones</p>
              </CardContent>
            </Card>

            <Card className="border-amber-100 bg-amber-50/40">
              <CardContent className="p-4">
                <span className="text-xs text-amber-700 font-semibold uppercase tracking-wider">Indemnizaciones Art. 64</span>
                <p className="text-2xl font-bold text-amber-900 mt-1">{formatCurrency(liqMetrics.totalIndemnity)}</p>
                <p className="text-[11px] text-amber-600 mt-0.5">Despidos sin justa causa</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabla de Casos de Liquidación */}
          <Card className="border-slate-200">
            <CardHeader className="py-4 border-b bg-slate-50/60 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                Historial de Casos y Cumplimiento CST
              </CardTitle>
              <span className="text-xs text-slate-500">
                Mostrando {filteredLiquidations.length} de {liquidations.length} casos
              </span>
            </CardHeader>
            <CardContent className="p-0">
              {filteredLiquidations.length === 0 ? (
                <div className="p-10 text-center text-slate-400 text-sm">
                  No se encontraron liquidaciones para los filtros seleccionados.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50/40 text-xs text-slate-500 font-semibold uppercase tracking-wider">
                        <th className="py-3 px-4">Colaborador / Cargo</th>
                        <th className="py-3 px-4">Fecha & Motivo</th>
                        <th className="py-3 px-4">Bases CST Aplicadas</th>
                        <th className="py-3 px-4">Conformidad Legal</th>
                        <th className="py-3 px-4 text-right">Neto Liquidado</th>
                        <th className="py-3 px-4 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredLiquidations.map(liq => {
                        let parsedCalc: ParsedLiquidationCalc = {};
                        try {
                          parsedCalc = JSON.parse(liq.calculations);
                        } catch {
                          // continúa
                        }

                        const sevBase = parsedCalc.basesUsed?.severanceBase || liq.baseSalary;
                        const vacBase = parsedCalc.basesUsed?.vacationBase || liq.baseSalary;
                        const hasDifferentBases = Math.abs(sevBase - vacBase) > 10;

                        return (
                          <tr key={liq.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4">
                              <p className="font-semibold text-slate-900">{liq.employee.name}</p>
                              <p className="text-xs text-slate-500">{liq.employee.position} · CC {liq.employee.document}</p>
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-medium text-slate-800">{formatDate(liq.terminationDate)}</p>
                              <span className="inline-block mt-0.5 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                                {REASON_LABELS[liq.reason] ?? liq.reason}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-xs space-y-0.5">
                              <div><span className="text-slate-400">Cesantías:</span> <strong className="text-slate-800">{formatCurrency(sevBase)}</strong></div>
                              <div><span className="text-slate-400">Vacaciones:</span> <strong className="text-slate-800">{formatCurrency(vacBase)}</strong></div>
                            </td>
                            <td className="py-3 px-4">
                              {hasDifferentBases ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  Art. 192 CST (Diferenciado)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                                  Salario Básico Fijo
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <p className="font-bold text-slate-900 text-base">{formatCurrency(liq.netPay)}</p>
                              {liq.totalIndemnity > 0 && (
                                <span className="text-[11px] text-rose-600 font-medium block">
                                  Inc. Indemniz: {formatCurrency(liq.totalIndemnity)}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedLiquidation(liq)}
                                className="h-8 px-2.5 text-xs text-blue-700 border-blue-200 hover:bg-blue-50 flex items-center gap-1 mx-auto"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Auditar</span>
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* PESTAÑA 2: HISTORIAL DE NÓMINAS Y NOVEDADES POR COLABORADOR          */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'nominas' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Barra de Selección y Filtros */}
          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-4 sm:p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 items-end">
                {/* Selector de Colaborador */}
                <div className="space-y-1.5 lg:col-span-2">
                  <Label className="text-xs font-semibold text-slate-700">Seleccionar Colaborador</Label>
                  <Select value={selectedEmpId} onValueChange={(val) => setSelectedEmpId(val || '')}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Selecciona un empleado...">
                        {selectedEmployee ? `${selectedEmployee.name} — ${selectedEmployee.position}` : 'Selecciona...'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <div className="px-2 py-1 text-xs text-slate-400 font-semibold uppercase tracking-wider">Activos</div>
                      {employees.filter(e => e.isActive).map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name} — {emp.position} (CC {emp.document})
                        </SelectItem>
                      ))}
                      {employees.filter(e => !e.isActive).length > 0 && (
                        <>
                          <div className="px-2 py-1 mt-1 text-xs text-slate-400 font-semibold uppercase tracking-wider border-t">Inactivos / Liquidados</div>
                          {employees.filter(e => !e.isActive).map(emp => (
                            <SelectItem key={emp.id} value={emp.id} className="text-slate-400">
                              {emp.name} — {emp.position} (Liquidado)
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filtro Año */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Año de Nómina</Label>
                  <Select value={payYear} onValueChange={(val) => setPayYear(val || 'all')}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Año">
                        {payYear === 'all' ? 'Todos los años' : payYear}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los años</SelectItem>
                      {payrollYears.map(y => (
                        <SelectItem key={y} value={y}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filtro Mes */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Mes</Label>
                  <Select value={payMonth} onValueChange={(val) => setPayMonth(val || 'all')}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Mes">
                        {MONTHS.find(m => m.value === payMonth)?.label ?? 'Mes'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ficha del Colaborador + Acumulados */}
          {selectedEmployee && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Información General */}
              <Card className="border-slate-200 bg-slate-50/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-700 flex items-center justify-between">
                    <span>Ficha del Colaborador</span>
                    {selectedEmployee.isActive ? (
                      <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">Activo</span>
                    ) : (
                      <span className="text-xs bg-red-100 text-red-800 font-semibold px-2 py-0.5 rounded-full">Liquidado</span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-slate-600">
                  <div><strong className="text-slate-900 text-base">{selectedEmployee.name}</strong></div>
                  <div className="flex justify-between"><span>Cargo:</span><span className="font-medium text-slate-800">{selectedEmployee.position}</span></div>
                  <div className="flex justify-between"><span>Documento:</span><span className="font-medium text-slate-800">CC {selectedEmployee.document}</span></div>
                  <div className="flex justify-between"><span>Salario Básico:</span><span className="font-semibold text-slate-900">{formatCurrency(selectedEmployee.baseSalary)}</span></div>
                  <div className="flex justify-between"><span>Fecha Ingreso:</span><span>{formatDate(selectedEmployee.hireDate)}</span></div>
                  {selectedEmployee.terminationDate && (
                    <div className="flex justify-between text-red-700"><span>Fecha Retiro:</span><span className="font-medium">{formatDate(selectedEmployee.terminationDate)}</span></div>
                  )}
                </CardContent>
              </Card>

              {/* Métricas Acumuladas de Variables y Recargos */}
              <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3.5">
                  <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">H. Extras Acumuladas</span>
                  <p className="text-xl font-bold text-blue-950 mt-1">{formatCurrency(empAccumulatedMetrics.totalOvertimePay)}</p>
                  <p className="text-[11px] text-blue-600 mt-0.5">{empAccumulatedMetrics.totalOvertimeHours} horas liquidadas</p>
                </div>

                <div className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-3.5">
                  <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">Recargos Ordinarios</span>
                  <p className="text-xl font-bold text-indigo-950 mt-1">{formatCurrency(empAccumulatedMetrics.totalNightSurcharges)}</p>
                  <p className="text-[11px] text-indigo-600 mt-0.5">Nocturnos (35%) y Festivos</p>
                </div>

                <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3.5">
                  <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Comisiones / Bonos</span>
                  <p className="text-xl font-bold text-amber-950 mt-1">{formatCurrency(empAccumulatedMetrics.totalCommissions)}</p>
                  <p className="text-[11px] text-amber-600 mt-0.5">Otros devengados salariales</p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Total Devengado</span>
                  <p className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(empAccumulatedMetrics.totalDevengado)}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{empAccumulatedMetrics.totalDaysWorked} días trabajados</p>
                </div>

                <div className="bg-rose-50/60 border border-rose-200 rounded-xl p-3.5">
                  <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider">Deducciones Nómina</span>
                  <p className="text-xl font-bold text-rose-950 mt-1">{formatCurrency(empAccumulatedMetrics.totalDeducciones)}</p>
                  <p className="text-[11px] text-rose-600 mt-0.5">Salud + Pensión de ley</p>
                </div>

                <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3.5">
                  <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Neto Percibido</span>
                  <p className="text-xl font-bold text-emerald-950 mt-1">{formatCurrency(empAccumulatedMetrics.totalNetPay)}</p>
                  <p className="text-[11px] text-emerald-600 mt-0.5">En {empAccumulatedMetrics.totalPeriods} periodos liquidados</p>
                </div>
              </div>
            </div>
          )}

          {/* Tabla de Nóminas Quincena a Quincena */}
          <Card className="border-slate-200">
            <CardHeader className="py-4 border-b bg-slate-50/60 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                  <History className="w-4 h-4 text-blue-600" />
                  Historial Cronológico de Nóminas y Novedades
                </CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Desglose exacto de lo devengado en cada periodo para {selectedEmployee?.name}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportPayrollExcel}
                disabled={filteredPayrollRecords.length === 0}
                className="bg-white border-slate-300 text-xs flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>Exportar Historial</span>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {filteredPayrollRecords.length === 0 ? (
                <div className="p-10 text-center text-slate-400 text-sm">
                  No hay nóminas registradas para este colaborador en el periodo seleccionado.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50/40 text-xs text-slate-500 font-semibold uppercase tracking-wider">
                        <th className="py-3 px-4">Periodo de Nómina</th>
                        <th className="py-3 px-3 text-center">Días</th>
                        <th className="py-3 px-4">Básico Periodo</th>
                        <th className="py-3 px-4">Horas Extras</th>
                        <th className="py-3 px-4">Recargos Ordinarios</th>
                        <th className="py-3 px-4">Comisiones / Otros</th>
                        <th className="py-3 px-4">Deducciones</th>
                        <th className="py-3 px-4 text-right">Neto Pagado</th>
                        <th className="py-3 px-3 text-center">Detalle</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredPayrollRecords.map(r => {
                        let calc: PayrollCalculationsData = {};
                        let nov: PayrollNovedadesData = {};
                        try {
                          calc = JSON.parse(r.calculations);
                          nov = JSON.parse(r.novedades || '{}');
                        } catch {
                          // continúa
                        }

                        const dev = calc.devengado || {};
                        const rec = dev.recargos || {};

                        const otPay = (Number(rec.extraDiurna) || 0) + 
                                      (Number(rec.extraNocturna) || 0) + 
                                      (Number(rec.extraDominicalDiurna) || 0) + 
                                      (Number(rec.extraDominicalNocturna) || 0);

                        const totalOtHours = (Number(nov.extraDiurnaHours) || 0) + 
                                             (Number(nov.extraNocturnaHours) || 0) + 
                                             (Number(nov.extraDiurnaDominicalFestivoHours) || 0) + 
                                             (Number(nov.extraNocturnaDominicalFestivoHours) || 0);

                        const nightSurch = (Number(rec.recargoNocturno) || 0) + 
                                           (Number(rec.recargoDominical) || 0) + 
                                           (Number(rec.recargoDominicalNocturno) || 0);

                        return (
                          <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4">
                              <p className="font-semibold text-slate-900">
                                {formatDate(r.period.startDate)} — {formatDate(r.period.endDate)}
                              </p>
                              <span className="text-[11px] text-slate-400">
                                {r.period.isQuincenal ? 'Quincenal' : 'Mensual'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center font-medium">
                              {r.daysWorked}
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-800">
                              {formatCurrency(dev.basicSalaryPeriod || 0)}
                            </td>
                            <td className="py-3 px-4">
                              {otPay > 0 ? (
                                <div>
                                  <span className="font-semibold text-blue-700">{formatCurrency(otPay)}</span>
                                  <span className="block text-[11px] text-slate-400">{totalOtHours} hrs reportadas</span>
                                </div>
                              ) : (
                                <span className="text-slate-400 text-xs">$0</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {nightSurch > 0 ? (
                                <div>
                                  <span className="font-semibold text-indigo-700">{formatCurrency(nightSurch)}</span>
                                  {(rec.recargoNocturno || 0) > 0 && (
                                    <span className="block text-[11px] text-indigo-500 font-medium">
                                      Nocturno: {formatCurrency(rec.recargoNocturno || 0)}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 text-xs">$0</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {(dev.otherIncomes || 0) > 0 ? (
                                <span className="font-semibold text-amber-700">{formatCurrency(dev.otherIncomes || 0)}</span>
                              ) : (
                                <span className="text-slate-400 text-xs">$0</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-xs text-rose-700 font-medium">
                              -{formatCurrency(r.totalDeducciones)}
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-slate-900 text-base">
                              {formatCurrency(r.netPay)}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedPayrollRecord(r)}
                                className="h-8 w-8 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-full"
                                title="Ver colilla detallada"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 1: DETALLE DE AUDITORÍA DE LIQUIDACIÓN DEFINITIVA              */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <Dialog open={!!selectedLiquidation} onOpenChange={(open) => !open && setSelectedLiquidation(null)}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 print:p-0 print:border-none">
          {selectedLiquidation && (() => {
            let parsed: ParsedLiquidationCalc = {};
            try {
              parsed = JSON.parse(selectedLiquidation.calculations);
            } catch {
              // continúa
            }

            const sevBase = parsed.basesUsed?.severanceBase || selectedLiquidation.baseSalary;
            const premBase = parsed.basesUsed?.premiumBase || selectedLiquidation.baseSalary;
            const vacBase = parsed.basesUsed?.vacationBase || selectedLiquidation.baseSalary;

            return (
              <div className="space-y-6">
                <DialogHeader className="border-b pb-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <DialogTitle className="text-lg font-bold text-slate-900">
                        Auditoría Legal de Liquidación Definitiva
                      </DialogTitle>
                      <DialogDescription className="text-xs text-slate-500">
                        Comprobante de trazabilidad normativa y cálculo del retiro laboral
                      </DialogDescription>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border">
                      {REASON_LABELS[selectedLiquidation.reason] ?? selectedLiquidation.reason}
                    </span>
                  </div>
                </DialogHeader>

                {/* Datos del Colaborador */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs sm:text-sm text-slate-700 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div><span className="text-slate-400">Colaborador:</span> <strong className="text-slate-900">{selectedLiquidation.employee.name}</strong></div>
                  <div><span className="text-slate-400">Documento:</span> <strong>CC {selectedLiquidation.employee.document}</strong></div>
                  <div><span className="text-slate-400">Cargo:</span> {selectedLiquidation.employee.position}</div>
                  <div><span className="text-slate-400">Fecha Retiro:</span> <strong className="text-blue-900">{formatDate(selectedLiquidation.terminationDate)}</strong></div>
                  <div><span className="text-slate-400">Salario Básico Contractual:</span> {formatCurrency(selectedLiquidation.baseSalary)}</div>
                  <div><span className="text-slate-400">Tipo de Contrato:</span> {selectedLiquidation.employee.contractType}</div>
                </div>

                {/* Cuadro de Trazabilidad CST de las Bases */}
                <div className="border border-blue-200 bg-blue-50/40 rounded-xl p-4 space-y-3">
                  <h4 className="text-xs font-bold text-blue-950 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    Bases Salariales Auditadas según CST
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="bg-white p-3 rounded-lg border border-blue-100 space-y-1">
                      <span className="text-slate-500 font-medium">Base Cesantías</span>
                      <p className="text-base font-bold text-slate-900">{formatCurrency(sevBase)}</p>
                      <p className="text-[11px] text-blue-700">Art. 253 CST: Básico + Prom. Variables Año + Aux. Transporte</p>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-blue-100 space-y-1">
                      <span className="text-slate-500 font-medium">Base Prima</span>
                      <p className="text-base font-bold text-slate-900">{formatCurrency(premBase)}</p>
                      <p className="text-[11px] text-blue-700">Art. 306 CST: Básico + Prom. Variables Semestre + Aux. Transporte</p>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-blue-100 space-y-1">
                      <span className="text-slate-500 font-medium">Base Vacaciones</span>
                      <p className="text-base font-bold text-slate-900">{formatCurrency(vacBase)}</p>
                      <p className="text-[11px] text-amber-700 font-medium">
                        Art. 192 CST: Básico + Recargo Nocturno. <strong>Sin Horas Extras ni Aux.</strong>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Desglose Prestacional */}
                <div className="space-y-2 text-xs sm:text-sm">
                  <h4 className="font-semibold text-slate-800 border-b pb-1">Desglose de Liquidación Final</h4>
                  <div className="flex justify-between py-1"><span>Cesantías Proporcionales:</span><span className="font-semibold">{formatCurrency(selectedLiquidation.totalSeverance)}</span></div>
                  <div className="flex justify-between py-1"><span>Intereses sobre Cesantías (12%):</span><span className="font-semibold">{formatCurrency(selectedLiquidation.totalInterests)}</span></div>
                  <div className="flex justify-between py-1"><span>Prima de Servicios:</span><span className="font-semibold">{formatCurrency(selectedLiquidation.totalPremium)}</span></div>
                  <div className="flex justify-between py-1"><span>Vacaciones Compensadas en Dinero:</span><span className="font-semibold">{formatCurrency(selectedLiquidation.totalVacations)}</span></div>
                  {selectedLiquidation.totalIndemnity > 0 && (
                    <div className="flex justify-between py-1 text-rose-700 font-medium">
                      <span>Indemnización por Despido (Art. 64 CST):</span>
                      <span className="font-bold">{formatCurrency(selectedLiquidation.totalIndemnity)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 border-t mt-2 text-base font-bold text-slate-900">
                    <span>Total Liquidado Neto:</span>
                    <span className="text-blue-700">{formatCurrency(selectedLiquidation.netPay)}</span>
                  </div>
                </div>

                <DialogFooter className="flex justify-between sm:justify-between pt-2 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => window.print()}
                    className="flex items-center gap-1 text-xs"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Imprimir Comprobante</span>
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    onClick={() => setSelectedLiquidation(null)}
                    className="text-xs bg-slate-900 hover:bg-slate-800"
                  >
                    Cerrar Auditoría
                  </Button>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 2: COLILLA DE PAGO DETALLADA DE NÓMINA                        */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <Dialog open={!!selectedPayrollRecord} onOpenChange={(open) => !open && setSelectedPayrollRecord(null)}>
        <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          {selectedPayrollRecord && (() => {
            let calc: PayrollCalculationsData = {};
            let nov: PayrollNovedadesData = {};
            try {
              calc = JSON.parse(selectedPayrollRecord.calculations);
              nov = JSON.parse(selectedPayrollRecord.novedades || '{}');
            } catch {
              // continúa
            }

            const dev = calc.devengado || {};
            const rec = dev.recargos || {};
            const ded = calc.deducciones || {};

            return (
              <div className="space-y-4">
                <DialogHeader className="border-b pb-3">
                  <DialogTitle className="text-base font-bold text-slate-900">
                    Colilla de Pago de Nómina
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500">
                    Periodo {formatDate(selectedPayrollRecord.period.startDate)} al {formatDate(selectedPayrollRecord.period.endDate)} · {selectedEmployee?.name}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 text-xs sm:text-sm">
                  {/* Devengados */}
                  <div>
                    <h5 className="font-semibold text-emerald-800 text-xs uppercase tracking-wider mb-1.5 border-b pb-1">Conceptos Devengados</h5>
                    <div className="space-y-1">
                      <div className="flex justify-between"><span>Salario Básico ({selectedPayrollRecord.daysWorked} días):</span><span>{formatCurrency(dev.basicSalaryPeriod || 0)}</span></div>
                      {(dev.auxilioTransporte || 0) > 0 && (
                        <div className="flex justify-between"><span>Auxilio de Transporte:</span><span>{formatCurrency(dev.auxilioTransporte || 0)}</span></div>
                      )}
                      {(rec.recargoNocturno || 0) > 0 && (
                        <div className="flex justify-between"><span>Recargo Nocturno Ordinario (35%):</span><span>{formatCurrency(rec.recargoNocturno || 0)}</span></div>
                      )}
                      {((rec.recargoDominical || 0) > 0 || (rec.recargoDominicalNocturno || 0) > 0) && (
                        <div className="flex justify-between"><span>Recargo Dominical / Festivo:</span><span>{formatCurrency((rec.recargoDominical || 0) + (rec.recargoDominicalNocturno || 0))}</span></div>
                      )}
                      {(rec.extraDiurna || 0) > 0 && (
                        <div className="flex justify-between"><span>Horas Extras Diurnas ({nov.extraDiurnaHours || 0} hrs):</span><span>{formatCurrency(rec.extraDiurna || 0)}</span></div>
                      )}
                      {(rec.extraNocturna || 0) > 0 && (
                        <div className="flex justify-between"><span>Horas Extras Nocturnas ({nov.extraNocturnaHours || 0} hrs):</span><span>{formatCurrency(rec.extraNocturna || 0)}</span></div>
                      )}
                      {((rec.extraDominicalDiurna || 0) > 0 || (rec.extraDominicalNocturna || 0) > 0) && (
                        <div className="flex justify-between"><span>Horas Extras Festivas:</span><span>{formatCurrency((rec.extraDominicalDiurna || 0) + (rec.extraDominicalNocturna || 0))}</span></div>
                      )}
                      {(dev.otherIncomes || 0) > 0 && (
                        <div className="flex justify-between"><span>Comisiones / Bonificaciones:</span><span>{formatCurrency(dev.otherIncomes || 0)}</span></div>
                      )}
                      <div className="flex justify-between font-semibold pt-1 border-t text-emerald-900">
                        <span>Total Devengado:</span>
                        <span>{formatCurrency(selectedPayrollRecord.totalDevengado)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Deducciones */}
                  <div>
                    <h5 className="font-semibold text-rose-800 text-xs uppercase tracking-wider mb-1.5 border-b pb-1">Deducciones de Ley</h5>
                    <div className="space-y-1">
                      <div className="flex justify-between"><span>Aporte Salud (4%):</span><span className="text-rose-700">-{formatCurrency(ded.salud || 0)}</span></div>
                      <div className="flex justify-between"><span>Aporte Pensión (4%):</span><span className="text-rose-700">-{formatCurrency(ded.pension || 0)}</span></div>
                      {(ded.otherDeductions || 0) > 0 && (
                        <div className="flex justify-between"><span>Otras Deducciones:</span><span className="text-rose-700">-{formatCurrency(ded.otherDeductions || 0)}</span></div>
                      )}
                      <div className="flex justify-between font-semibold pt-1 border-t text-rose-900">
                        <span>Total Deducciones:</span>
                        <span>-{formatCurrency(selectedPayrollRecord.totalDeducciones)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Total Neto */}
                  <div className="flex justify-between items-center bg-slate-100 p-3 rounded-lg font-bold text-slate-900 text-base">
                    <span>Neto a Pagar:</span>
                    <span className="text-blue-700">{formatCurrency(selectedPayrollRecord.netPay)}</span>
                  </div>
                </div>

                <DialogFooter className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedPayrollRecord(null)}
                    className="w-full text-xs"
                  >
                    Cerrar
                  </Button>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
