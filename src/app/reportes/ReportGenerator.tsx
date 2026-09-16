'use client';

import { useState, useMemo } from 'react';
import { Employee, LegalConfig } from '@prisma/client';

import { calculatePayroll, LegalConfig as ParsedConfig } from '@/lib/payrollEngine';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import * as xlsx from 'xlsx';

const REASON_LABELS: Record<string, string> = {
  renuncia: 'Renuncia Voluntaria',
  fin_contrato: 'Fin de Contrato (Fijo)',
  despido_con_justa_causa: 'Despido Con Justa Causa',
  despido_sin_justa_causa: 'Despido Sin Justa Causa',
};

interface FinalLiquidationItem {
  id: string;
  terminationDate: Date | string;
  reason: string;
  baseSalary: number;
  totalSeverance: number;
  totalInterests: number;
  totalPremium: number;
  totalVacations: number;
  totalIndemnity: number;
  netPay: number;
  employee: {
    document: string;
    name: string;
    position: string;
  };
}

interface PayrollRecordItem {
  id: string;
  employeeId: string;
  daysWorked: number;
  totalDevengado: number;
  totalDeducciones: number;
  netPay: number;
}

interface PayrollPeriodItem {
  id: string;
  startDate: Date | string;
  endDate: Date | string;
  isQuincenal: boolean;
  status: string;
  payrollRecords?: PayrollRecordItem[];
}

interface EmployeeWithDetails extends Employee {
  finalLiquidation?: unknown | null;
}

export interface PayrollReportRow {
  Documento: string;
  Nombre: string;
  Cargo: string;
  Banco: string;
  Cuenta: string;
  SalarioBase: number;
  DiasTrabajados: number;
  TotalDevengado: number;
  TotalDeducciones: number;
  NetoAPagar: number;
}

export interface LiquidationReportRow {
  Documento: string;
  Nombre: string;
  Cargo: string;
  FechaRetiro: string;
  Motivo: string;
  SalarioBase: number;
  Cesantias: number;
  InteresesCesantias: number;
  PrimaServicios: number;
  Vacaciones: number;
  Indemnizacion: number;
  TotalLiquidado: number;
}

export default function ReportGenerator({ 
  employees, 
  allEmployees = [],
  configs, 
  payrollPeriods,
  liquidationsHistory = []
}: { 
  employees: Employee[];
  allEmployees?: EmployeeWithDetails[];
  configs: LegalConfig[];
  payrollPeriods: PayrollPeriodItem[];
  liquidationsHistory?: FinalLiquidationItem[];
}) {
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('base');
  
  const reportData = useMemo<(PayrollReportRow | LiquidationReportRow)[]>(() => {
    // Si es reporte de Liquidaciones Definitivas (Histórico de Retirados)
    if (selectedPeriodId === 'liquidaciones') {
      return liquidationsHistory.map((liq): LiquidationReportRow => ({
        Documento: liq.employee?.document || 'N/A',
        Nombre: liq.employee?.name || 'N/A',
        Cargo: liq.employee?.position || 'N/A',
        FechaRetiro: new Date(liq.terminationDate).toISOString().split('T')[0],
        Motivo: REASON_LABELS[liq.reason] || liq.reason,
        SalarioBase: liq.baseSalary,
        Cesantias: liq.totalSeverance,
        InteresesCesantias: liq.totalInterests,
        PrimaServicios: liq.totalPremium,
        Vacaciones: liq.totalVacations,
        Indemnizacion: liq.totalIndemnity,
        TotalLiquidado: liq.netPay
      }));
    }

    if (!configs || configs.length === 0) return [];
    
    // Si es Plantilla Base (solo colaboradores activos que NO han sido liquidados)
    if (selectedPeriodId === 'base') {
      const config = configs[0];
      const parsedConfig: ParsedConfig = {
        validFrom: config.validFrom.toString(),
        configData: JSON.parse(config.configData)
      };

      return employees.map((emp): PayrollReportRow => {
        const result = calculatePayroll({
          baseSalary: emp.baseSalary,
          isIntegralSalary: emp.isIntegralSalary,
          arlRiskClass: emp.arlRiskClass,
          hireDate: emp.hireDate.toString(),
        }, {
          daysWorked: 30, 
          extraHoursDiurna: 0,
          extraHoursNocturna: 0,
          recargoNocturnoHours: 0,
          dominicalFestivoDiurnoHours: 0,
          dominicalFestivoNocturnoHours: 0,
          extraDiurnaDominicalFestivoHours: 0,
          extraNocturnaDominicalFestivoHours: 0,
          otherIncomes: 0,
          otherDeductions: 0
        }, parsedConfig);

        return {
          Documento: emp.document,
          Nombre: emp.name,
          Cargo: emp.position,
          Banco: emp.bankName || 'N/A',
          Cuenta: emp.bankAccount || 'N/A',
          SalarioBase: emp.baseSalary,
          DiasTrabajados: 30,
          TotalDevengado: result.devengado.totalDevengado,
          TotalDeducciones: result.deducciones.totalDeducciones,
          NetoAPagar: result.netPay
        };
      });
    }

    // Si es un periodo guardado (busca en allEmployees para no perder a los que se retiraron después)
    const selectedPeriod = payrollPeriods.find(p => p.id === selectedPeriodId);
    if (!selectedPeriod) return [];

    const empList = allEmployees && allEmployees.length > 0 ? allEmployees : employees;
    const records = selectedPeriod.payrollRecords || [];

    const rows: PayrollReportRow[] = [];
    for (const record of records) {
      const emp = empList.find(e => e.id === record.employeeId);
      if (emp) {
        const isRetirado = ('finalLiquidation' in emp && Boolean(emp.finalLiquidation)) || !emp.isActive;
        rows.push({

          Documento: emp.document,
          Nombre: emp.name + (isRetirado ? ' (Retirado)' : ''),
          Cargo: emp.position,
          Banco: emp.bankName || 'N/A',
          Cuenta: emp.bankAccount || 'N/A',
          SalarioBase: emp.baseSalary,
          DiasTrabajados: record.daysWorked,
          TotalDevengado: record.totalDevengado,
          TotalDeducciones: record.totalDeducciones,
          NetoAPagar: record.netPay
        });
      }
    }
    return rows;

  }, [employees, allEmployees, configs, payrollPeriods, liquidationsHistory, selectedPeriodId]);

  const formatPeriodLabel = (p: PayrollPeriodItem) => {
    const end = new Date(p.endDate);
    const monthName = end.toLocaleString('es-CO', { month: 'long', timeZone: 'UTC' });
    const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    const year = end.getUTCFullYear();
    const day = end.getUTCDate();
    if (p.isQuincenal) {
      const qNum = day <= 15 ? "1ra Quincena (1 al 15)" : `2da Quincena (16 al ${day})`;
      return `${capitalizedMonth} ${year} - ${qNum}`;
    }
    return `${capitalizedMonth} ${year} - Mes Completo`;
  };


  const isLiquidaciones = selectedPeriodId === 'liquidaciones';

  const exportExcel = () => {
    if (reportData.length === 0) return;
    
    const worksheet = xlsx.utils.json_to_sheet(reportData);
    const workbook = xlsx.utils.book_new();
    const sheetName = isLiquidaciones ? "Liquidaciones" : "Nomina";
    xlsx.utils.book_append_sheet(workbook, worksheet, sheetName);
    
    let fileName = 'Nomina_Plantilla_Base.xlsx';
    if (isLiquidaciones) {
      fileName = `Liquidaciones_Definitivas_Historico_${new Date().toISOString().split('T')[0]}.xlsx`;
    } else {
      const selectedPeriod = payrollPeriods.find(p => p.id === selectedPeriodId);
      const periodTag = selectedPeriod ? formatPeriodLabel(selectedPeriod).replace(/[\s\(\)\/]+/g, '_') : 'Plantilla_Base';
      fileName = `Nomina_${periodTag}.xlsx`;
    }

    xlsx.writeFile(workbook, fileName);
  };


  const exportCSV = () => {
    if (reportData.length === 0) return;
    const firstRow = reportData[0] as unknown as Record<string, unknown>;
    const headers = Object.keys(firstRow);
    const csvContent = [
      headers.join(','),
      ...reportData.map((row) => {
        const rowObj = row as unknown as Record<string, unknown>;
        return headers.map(header => {
          const val = rowObj[header];
          if (typeof val === 'string') return `"${val.replace(/"/g, '""')}"`;
          return String(val ?? '');
        }).join(',');
      })
    ].join('\n');
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);

    let fileName = 'Nomina_Plantilla_Base.csv';
    if (isLiquidaciones) {
      fileName = `Liquidaciones_Definitivas_Historico_${new Date().toISOString().split('T')[0]}.csv`;
    } else {
      const selectedPeriod = payrollPeriods.find(p => p.id === selectedPeriodId);
      const periodTag = selectedPeriod ? formatPeriodLabel(selectedPeriod).replace(/[\s\(\)\/]+/g, '_') : 'Plantilla_Base';
      fileName = `Nomina_${periodTag}.csv`;
    }

    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

  const selectedPeriod = payrollPeriods.find(p => p.id === selectedPeriodId);
  const selectedPeriodLabel = selectedPeriodId === 'base'
    ? 'Plantilla Base (30 días, colaboradores activos)'
    : selectedPeriodId === 'liquidaciones'
    ? `📜 Liquidaciones Definitivas (Histórico de Retirados) [${liquidationsHistory.length}]`
    : selectedPeriod
    ? formatPeriodLabel(selectedPeriod)
    : 'Seleccionar Periodo / Reporte...';

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <CardTitle>
            {isLiquidaciones 
              ? "Reporte de Liquidaciones Definitivas (Histórico de Retirados)" 
              : "Archivo para Banco y Transferencias de Nómina"}
          </CardTitle>
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <Label>Seleccionar Reporte / Periodo:</Label>
            <Select value={selectedPeriodId} onValueChange={(val) => setSelectedPeriodId(val || 'base')}>
              <SelectTrigger className="w-full sm:w-[420px]">
                <SelectValue placeholder="Seleccionar Periodo...">
                  {selectedPeriodLabel}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="base">Plantilla Base (30 días, colaboradores activos)</SelectItem>
                <SelectItem value="liquidaciones" className="text-red-700 font-medium">
                  📜 Liquidaciones Definitivas (Histórico de Retirados) {liquidationsHistory.length > 0 ? `(${liquidationsHistory.length})` : ''}
                </SelectItem>
                {payrollPeriods.length > 0 && (
                  <>
                    <div className="px-2 py-1 text-xs text-slate-400 font-semibold uppercase tracking-wider border-t mt-1">Nóminas Guardadas</div>
                    {payrollPeriods.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {formatPeriodLabel(p)}
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={exportCSV} className="flex-1 sm:flex-initial">
            CSV (Plano)
          </Button>
          <Button onClick={exportExcel} className="flex-1 sm:flex-initial bg-emerald-600 hover:bg-emerald-700">
            <Download className="mr-2 h-4 w-4" /> Exportar a Excel
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {reportData.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground">
            No hay datos para este reporte o periodo.
          </div>
        ) : isLiquidaciones ? (
          <div className="rounded-md border overflow-x-auto max-h-[460px]">
            <table className="min-w-[850px] w-full text-sm text-left">
              <thead className="bg-red-50/70 sticky top-0 text-slate-700">
                <tr>
                  <th className="p-3 border-b whitespace-nowrap">Documento</th>
                  <th className="p-3 border-b whitespace-nowrap">Nombre</th>
                  <th className="p-3 border-b whitespace-nowrap">Cargo</th>
                  <th className="p-3 border-b whitespace-nowrap">Fecha Retiro</th>
                  <th className="p-3 border-b whitespace-nowrap">Motivo</th>
                  <th className="p-3 border-b text-right whitespace-nowrap">Cesantías + Int</th>
                  <th className="p-3 border-b text-right whitespace-nowrap">Prima</th>
                  <th className="p-3 border-b text-right whitespace-nowrap">Vacaciones</th>
                  <th className="p-3 border-b text-right font-semibold text-red-900 whitespace-nowrap">Total Liquidado</th>
                </tr>
              </thead>
              <tbody>
                {(reportData as LiquidationReportRow[]).map((row, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="p-3 whitespace-nowrap">{row.Documento}</td>
                    <td className="p-3 font-medium text-slate-900 whitespace-nowrap">{row.Nombre}</td>
                    <td className="p-3 text-slate-600 whitespace-nowrap">{row.Cargo}</td>
                    <td className="p-3 text-xs whitespace-nowrap">{row.FechaRetiro}</td>
                    <td className="p-3 text-xs text-slate-600 whitespace-nowrap">{row.Motivo}</td>
                    <td className="p-3 text-right whitespace-nowrap">{formatCurrency((row.Cesantias || 0) + (row.InteresesCesantias || 0))}</td>
                    <td className="p-3 text-right whitespace-nowrap">{formatCurrency(row.PrimaServicios || 0)}</td>
                    <td className="p-3 text-right whitespace-nowrap">{formatCurrency(row.Vacaciones || 0)}</td>
                    <td className="p-3 text-right font-bold text-red-700 whitespace-nowrap">{formatCurrency(row.TotalLiquidado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto max-h-[400px]">
            <table className="min-w-[550px] w-full text-sm text-left">
              <thead className="bg-slate-50 sticky top-0 text-slate-700">
                <tr>
                  <th className="p-3 border-b whitespace-nowrap">Documento</th>
                  <th className="p-3 border-b whitespace-nowrap">Nombre</th>
                  <th className="p-3 border-b whitespace-nowrap">Banco</th>
                  <th className="p-3 border-b whitespace-nowrap">Cuenta</th>
                  <th className="p-3 border-b text-right whitespace-nowrap">Neto a Pagar</th>
                </tr>
              </thead>
              <tbody>
                {(reportData as PayrollReportRow[]).map((row, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="p-3 whitespace-nowrap">{row.Documento}</td>
                    <td className="p-3 font-medium whitespace-nowrap">{row.Nombre}</td>
                    <td className="p-3 whitespace-nowrap">{row.Banco}</td>
                    <td className="p-3 whitespace-nowrap">{row.Cuenta}</td>
                    <td className="p-3 text-right font-bold text-emerald-700 whitespace-nowrap">{formatCurrency(row.NetoAPagar)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-4">
          {isLiquidaciones
            ? "* Histórico consolidado de liquidaciones definitivas. Puedes exportar este reporte a Excel o CSV para archivos de auditoría laboral."
            : "* Nota: Al elegir una nómina guardada, los datos incluyen todas las horas extras y descuentos registrados. Los colaboradores retirados se indican con '(Retirado)'."}
        </p>
      </CardContent>
    </Card>
  );
}

