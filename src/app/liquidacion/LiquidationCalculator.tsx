'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { LegalConfig } from '@prisma/client';
import { calculateFinalLiquidation, LegalConfig as ParsedConfig } from '@/lib/payrollEngine';
import { saveFinalLiquidation } from '../actions/payrollActions';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// ── Tipos extendidos con la relación de Prisma ─────────────────────────────
type FinalLiquidationRecord = {
  id: string;
  employeeId: string;
  terminationDate: Date;
  reason: string;
  baseSalary: number;
  totalSeverance: number;
  totalInterests: number;
  totalPremium: number;
  totalVacations: number;
  totalIndemnity: number;
  netPay: number;
  calculations: string;
};

type EmployeeWithLiquidation = {
  id: string;
  document: string;
  name: string;
  position: string;
  hireDate: Date;
  terminationDate: Date | null;
  contractType: string;
  baseSalary: number;
  isIntegralSalary: boolean;
  arlRiskClass: string;
  bankName: string | null;
  bankAccount: string | null;
  isActive: boolean;
  finalLiquidation: FinalLiquidationRecord | null;
};

type LiquidationWithEmployee = FinalLiquidationRecord & {
  employee: { id: string; name: string; position: string; document: string };
};

// ── Etiquetas de motivos ────────────────────────────────────────────────────
const REASON_LABELS: Record<string, string> = {
  renuncia: 'Renuncia Voluntaria',
  fin_contrato: 'Fin de Contrato (Fijo)',
  despido_con_justa_causa: 'Despido Con Justa Causa',
  despido_sin_justa_causa: 'Despido Sin Justa Causa',
};

export default function LiquidationCalculator({
  employees,
  configs,
  liquidationsHistory,
}: {
  employees: EmployeeWithLiquidation[];
  configs: LegalConfig[];
  liquidationsHistory: LiquidationWithEmployee[];
}) {
  // Primer empleado activo sin liquidación
  const firstLiquidable = employees.find(e => e.isActive && !e.finalLiquidation);
  const [selectedEmpId, setSelectedEmpId] = useState<string>(firstLiquidable?.id || employees[0]?.id || '');

  const [inputs, setInputs] = useState({
    terminationDate: new Date().toISOString().split('T')[0],
    reason: 'renuncia',
    daysWorkedYear: 0,
    daysWorkedSemester: 0,
    vacationDaysOwed: 0,
    pendingSalaryDays: 0,
  });

  const selectedEmp = employees.find(e => e.id === selectedEmpId);
  const alreadyLiquidated = !!selectedEmp?.finalLiquidation;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

  const formatDate = (d: Date | string) =>
    new Date(d).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });

  // Días comerciales (año 360, mes 30 — Ley Colombiana)
  const getCommercialDays = (start: Date, end: Date) => {
    if (start > end) return 0;
    let d1 = start.getDate();
    const m1 = start.getMonth();
    const y1 = start.getFullYear();
    let d2 = end.getDate();
    const m2 = end.getMonth();
    const y2 = end.getFullYear();
    if (d1 === 31) d1 = 30;
    if (d2 === 31) d2 = 30;
    if (m1 === 1 && d1 >= 28) d1 = 30;
    if (m2 === 1 && d2 >= 28) d2 = 30;
    return ((y2 - y1) * 360) + ((m2 - m1) * 30) + (d2 - d1) + 1;
  };

  const prevEmpIdRef = React.useRef(selectedEmpId);

  const getLastAnniversary = (hire: Date, term: Date) => {
    let last = new Date(term.getFullYear(), hire.getMonth(), hire.getDate());
    if (last > term) last = new Date(term.getFullYear() - 1, hire.getMonth(), hire.getDate());
    return last < hire ? hire : last;
  };

  useEffect(() => {
    if (!selectedEmp || !inputs.terminationDate || alreadyLiquidated) return;
    const termDate = new Date(inputs.terminationDate);
    const hireDate = new Date(selectedEmp.hireDate);
    const termYear = termDate.getFullYear();
    const termMonth = termDate.getMonth();

    const startOfYear = new Date(termYear, 0, 1);
    const cesantiasStart = hireDate > startOfYear ? hireDate : startOfYear;

    const isSecondSemester = termMonth >= 6;
    const startOfSemester = isSecondSemester ? new Date(termYear, 6, 1) : new Date(termYear, 0, 1);
    const primaStart = hireDate > startOfSemester ? hireDate : startOfSemester;

    const startOfMonth = new Date(termYear, termMonth, 1);
    const pendingDaysStart = hireDate > startOfMonth ? hireDate : startOfMonth;

    const empChanged = prevEmpIdRef.current !== selectedEmpId;
    prevEmpIdRef.current = selectedEmpId;

    const anniversary = getLastAnniversary(hireDate, termDate);
    const roundedVacations = Math.round(((getCommercialDays(anniversary, termDate) / 360) * 15) * 100) / 100;
    const rawPending = getCommercialDays(pendingDaysStart, termDate);

    setInputs(prev => ({
      ...prev,
      daysWorkedYear: Math.max(0, getCommercialDays(cesantiasStart, termDate)),
      daysWorkedSemester: Math.max(0, getCommercialDays(primaStart, termDate)),
      vacationDaysOwed: empChanged ? Math.max(0, roundedVacations) : prev.vacationDaysOwed,
      pendingSalaryDays: Math.min(30, Math.max(0, rawPending)),
    }));
  }, [selectedEmp, selectedEmpId, inputs.terminationDate, alreadyLiquidated]);


  const activeConfig = useMemo(() => {
    const pDate = new Date(inputs.terminationDate);
    return configs.find(c => new Date(c.validFrom) <= pDate) || configs[configs.length - 1];
  }, [inputs.terminationDate, configs]);

  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const result = useMemo(() => {
    try {
      if (!selectedEmp || !activeConfig || alreadyLiquidated) return null;
      const parsedConfig: ParsedConfig = {
        validFrom: activeConfig.validFrom.toString(),
        configData: JSON.parse(activeConfig.configData),
      };
      return calculateFinalLiquidation(
        { baseSalary: selectedEmp.baseSalary, isIntegralSalary: selectedEmp.isIntegralSalary, arlRiskClass: selectedEmp.arlRiskClass, hireDate: selectedEmp.hireDate.toString() },
        inputs.terminationDate, inputs.reason,
        inputs.daysWorkedYear, inputs.daysWorkedSemester,
        inputs.vacationDaysOwed, inputs.pendingSalaryDays,
        parsedConfig
      );
    } catch (e) {
      console.error('Error calculando liquidación:', e);
      return null;
    }
  }, [selectedEmp, inputs, activeConfig, alreadyLiquidated]);

  const hasError = !result && !alreadyLiquidated && !!selectedEmp;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputs(prev => ({ ...prev, [e.target.name]: e.target.type === 'number' ? Number(e.target.value) || 0 : e.target.value }));
  };

  const handleSaveClick = () => {
    if (!result || hasError || !selectedEmp || alreadyLiquidated) return;
    setIsDialogOpen(true);
  };

  const executeSave = async () => {
    if (!result || hasError || !selectedEmp) return;
    setIsSaving(true);
    try {
      await saveFinalLiquidation({
        employeeId: selectedEmp.id,
        terminationDate: inputs.terminationDate,
        reason: inputs.reason,
        baseSalary: selectedEmp.baseSalary,
        totalSeverance: result.benefits.severance,
        totalInterests: result.benefits.interests,
        totalPremium: result.benefits.premium,
        totalVacations: result.benefits.vacations,
        totalIndemnity: result.indemnity,
        netPay: result.netPay,
        calculations: result,
      });
      setIsDialogOpen(false);
      router.refresh();
      const next = employees.find(e => e.id !== selectedEmp.id && !e.finalLiquidation && e.isActive);
      setSelectedEmpId(next?.id || '');
    } catch (e) {
      console.error(e);
      alert('Hubo un error al guardar la liquidación.');
    } finally {
      setIsSaving(false);
    }
  };

  if (employees.length === 0) {
    return <Card className="p-6 text-center text-slate-500">No hay empleados registrados en el sistema.</Card>;
  }

  return (
    <div className="space-y-10">
      {/* ── Grid: Formulario + Resultado ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 print:block">

        {/* Izquierda: Entradas */}
        <Card className="print:hidden">
          <CardHeader><CardTitle>Datos de Retiro</CardTitle></CardHeader>
          <CardContent className="space-y-4">

            {/* Selector de empleado */}
            <div className="space-y-2">
              <Label>Empleado</Label>
              <Select value={selectedEmpId} onValueChange={(val) => setSelectedEmpId(val || '')}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona...">
                    {selectedEmp ? (
                      <span className="flex items-center gap-2">
                        {selectedEmp.name}
                        {selectedEmp.finalLiquidation && (
                          <span className="text-xs bg-red-100 text-red-700 border border-red-200 px-1.5 py-0.5 rounded-full font-medium">Ya Liquidado</span>
                        )}
                        {!selectedEmp.isActive && !selectedEmp.finalLiquidation && (
                          <span className="text-xs bg-slate-100 text-slate-500 border px-1.5 py-0.5 rounded-full">Inactivo</span>
                        )}
                      </span>
                    ) : 'Selecciona...'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {/* Activos liquidables */}
                  {employees.filter(e => e.isActive && !e.finalLiquidation).length > 0 && (
                    <>
                      <div className="px-2 py-1 text-xs text-slate-400 font-semibold uppercase tracking-wider">Activos · Pendientes</div>
                      {employees.filter(e => e.isActive && !e.finalLiquidation).map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>{emp.name} — {emp.position}</SelectItem>
                      ))}
                    </>
                  )}
                  {/* Ya liquidados */}
                  {employees.filter(e => !!e.finalLiquidation).length > 0 && (
                    <>
                      <div className="px-2 py-1.5 mt-1 text-xs text-red-400 font-semibold uppercase tracking-wider border-t">🔒 Ya Liquidados</div>
                      {employees.filter(e => !!e.finalLiquidation).map(emp => (
                        <SelectItem key={emp.id} value={emp.id} className="text-slate-400">
                          {emp.name} — {formatDate(emp.finalLiquidation!.terminationDate)}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Banner bloqueo */}
            {alreadyLiquidated && selectedEmp?.finalLiquidation && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-2">
                <p className="font-semibold text-red-800">🔒 Este colaborador ya fue liquidado definitivamente</p>
                <div className="text-sm text-red-700 space-y-1">
                  <div className="flex justify-between"><span>Fecha de retiro:</span><span className="font-medium">{formatDate(selectedEmp.finalLiquidation.terminationDate)}</span></div>
                  <div className="flex justify-between"><span>Motivo:</span><span className="font-medium">{REASON_LABELS[selectedEmp.finalLiquidation.reason] ?? selectedEmp.finalLiquidation.reason}</span></div>
                  <div className="flex justify-between border-t border-red-200 pt-1 mt-1"><span className="font-semibold">Total liquidado:</span><span className="font-bold text-base">{formatCurrency(selectedEmp.finalLiquidation.netPay)}</span></div>
                </div>
                <p className="text-xs text-red-500 mt-1">Para liquidarlo nuevamente debe ser recontratado (actualizar fecha de ingreso en el módulo de Empleados).</p>
              </div>
            )}

            {/* Formulario (solo si no está bloqueado) */}
            {!alreadyLiquidated && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Fecha de Retiro</Label>
                  <Input type="date" name="terminationDate" value={inputs.terminationDate} onChange={handleChange} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Motivo</Label>
                  <Select value={inputs.reason} onValueChange={(val) => setInputs(p => ({ ...p, reason: val || 'renuncia' }))}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecciona...">{REASON_LABELS[inputs.reason]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(REASON_LABELS).map(([val, label]) => (
                        <SelectItem key={val} value={val}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2 text-sm text-slate-500 pt-2 border-b pb-2">
                  Tiempos para cálculo proporcional. <strong>¡Se calculan automáticamente!</strong> Ajusta vacaciones si hay días anteriores o si adelantó vacaciones.
                </div>
                <div className="space-y-2"><Label>Días laborados este año (Cesantías)</Label><Input type="number" name="daysWorkedYear" value={inputs.daysWorkedYear} onChange={handleChange} min="0" max="360" /></div>
                <div className="space-y-2"><Label>Días laborados semestre (Prima)</Label><Input type="number" name="daysWorkedSemester" value={inputs.daysWorkedSemester} onChange={handleChange} min="0" max="180" /></div>
                <div className="space-y-2"><Label>Días de vacaciones a pagar</Label><Input type="number" step="0.01" name="vacationDaysOwed" value={inputs.vacationDaysOwed} onChange={handleChange} /></div>
                <div className="space-y-2"><Label>Días pendientes de pago (Último mes)</Label><Input type="number" name="pendingSalaryDays" value={inputs.pendingSalaryDays} onChange={handleChange} min="0" max="30" /></div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Derecha: Resultado o comprobante de bloqueo */}
        {alreadyLiquidated && selectedEmp?.finalLiquidation ? (
          <Card className="bg-slate-50 border-slate-200 flex flex-col justify-center p-6">
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">🔒</div>
              <h3 className="text-lg font-semibold text-slate-700">Liquidación ya registrada</h3>
              <p className="text-slate-500 text-sm">Comprobante de <strong>{selectedEmp.name}</strong></p>
            </div>
            <div className="bg-white border rounded-lg p-4 space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-600"><span>Cesantías</span><span>{formatCurrency(selectedEmp.finalLiquidation.totalSeverance)}</span></div>
              <div className="flex justify-between text-slate-600"><span>Int. Cesantías</span><span>{formatCurrency(selectedEmp.finalLiquidation.totalInterests)}</span></div>
              <div className="flex justify-between text-slate-600"><span>Prima</span><span>{formatCurrency(selectedEmp.finalLiquidation.totalPremium)}</span></div>
              <div className="flex justify-between text-slate-600"><span>Vacaciones</span><span>{formatCurrency(selectedEmp.finalLiquidation.totalVacations)}</span></div>
              {selectedEmp.finalLiquidation.totalIndemnity > 0 && (
                <div className="flex justify-between text-rose-700 font-medium"><span>Indemnización</span><span>{formatCurrency(selectedEmp.finalLiquidation.totalIndemnity)}</span></div>
              )}
              <div className="flex justify-between font-bold border-t pt-2 mt-1 text-slate-800 text-base">
                <span>Total Liquidado</span>
                <span>{formatCurrency(selectedEmp.finalLiquidation.netPay)}</span>
              </div>
            </div>
          </Card>
        ) : (
          <>
            {hasError && (
              <Card className="bg-red-50 border-red-200 col-span-2 p-6 text-red-800">
                Ocurrió un error calculando la liquidación. Verifica los datos ingresados.
              </Card>
            )}
            {result && !hasError && (
              <Card className="bg-slate-50 border-blue-100 print:shadow-none print:border-none print:bg-white print:col-span-2">
                <CardHeader className="bg-blue-50/50 pb-4 border-b print:bg-white print:border-b-2 print:border-black">
                  <CardTitle className="text-blue-800 text-lg flex justify-between items-center print:text-black">
                    <span>Liquidación — {selectedEmp?.name.split(' ')[0]} <span className="text-2xl ml-2">{formatCurrency(result.netPay)}</span></span>
                    <div className="flex gap-2 print:hidden">
                      <Button variant="outline" className="bg-white border-blue-200 text-blue-700 hover:bg-blue-50" onClick={() => window.print()}>🖨️ Imprimir</Button>
                      <Button variant="default" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleSaveClick} disabled={isSaving}>
                        {isSaving ? 'Guardando...' : '💾 Guardar e Inactivar'}
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-6 text-sm print:text-black">
                  <div>
                    <h4 className="font-semibold text-slate-700 mb-2 border-b pb-1">Salarios y Conceptos Pendientes</h4>
                    <div className="flex justify-between py-1"><span>Salario Básico ({inputs.pendingSalaryDays} días)</span><span>{formatCurrency(result.pendingSalary.basic)}</span></div>
                    <div className="flex justify-between py-1"><span>Auxilio de Transporte (si aplica)</span><span>{formatCurrency(result.pendingSalary.transport)}</span></div>
                    <div className="flex justify-between py-1 text-slate-600"><span>(-) Deducción Salud/Pensión</span><span>-{formatCurrency(result.pendingSalary.salud + result.pendingSalary.pension)}</span></div>
                    <div className="flex justify-between py-1 font-medium pt-1 border-t mt-1"><span>Total Pendiente a Pagar</span><span>{formatCurrency(result.pendingSalary.netPending)}</span></div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-700 mb-2 border-b pb-1">Prestaciones Sociales (Proporcional)</h4>
                    <div className="flex justify-between py-1"><span>Cesantías ({inputs.daysWorkedYear} días)</span><span>{formatCurrency(result.benefits.severance)}</span></div>
                    <div className="flex justify-between py-1"><span>Intereses sobre Cesantías (12% anual)</span><span>{formatCurrency(result.benefits.interests)}</span></div>
                    <div className="flex justify-between py-1"><span>Prima de Servicios ({inputs.daysWorkedSemester} días del sem.)</span><span>{formatCurrency(result.benefits.premium)}</span></div>
                    <div className="flex justify-between py-1"><span>Vacaciones ({inputs.vacationDaysOwed} días adeudados)</span><span>{formatCurrency(result.benefits.vacations)}</span></div>
                  </div>
                  {result.indemnity > 0 && (
                    <div className="bg-rose-50 p-3 rounded-md text-rose-800 border border-rose-200">
                      <h4 className="font-semibold mb-1">Indemnización (Aproximada)</h4>
                      <div className="flex justify-between"><span>Por Despido Sin Justa Causa</span><span className="font-bold">{formatCurrency(result.indemnity)}</span></div>
                      <p className="text-xs mt-2 opacity-80">⚠ Esta es una estimación genérica. Verifica con tu contador o abogado el cálculo exacto Art. 64 CST.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Diálogo de confirmación */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>¿Confirmar liquidación definitiva?</DialogTitle>
              <DialogDescription className="pt-2">
                Estás a punto de registrar la liquidación definitiva de <strong>{selectedEmp?.name}</strong> por <strong>{result && !hasError ? formatCurrency(result.netPay) : '$0'}</strong>.
                <br /><br />
                Esta acción <strong>inactivará al empleado</strong> y quedará bloqueado para futuras liquidaciones hasta ser recontratado.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="sm:justify-end mt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>Cancelar</Button>
              <Button type="button" variant="destructive" className="bg-red-600 hover:bg-red-700 text-white" onClick={executeSave} disabled={isSaving}>
                {isSaving ? 'Guardando...' : 'Confirmar y Guardar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Sección C: Historial de Liquidaciones ── */}
      <div className="print:hidden">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-xl font-semibold tracking-tight">Historial de Liquidaciones Definitivas</h2>
          {liquidationsHistory.length > 0 && (
            <span className="bg-slate-100 text-slate-600 text-sm font-medium px-2.5 py-0.5 rounded-full border">
              {liquidationsHistory.length} registro{liquidationsHistory.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {liquidationsHistory.length === 0 ? (
          <Card className="p-6 text-center text-slate-400 text-sm">Aún no se han registrado liquidaciones definitivas.</Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {liquidationsHistory.map((liq) => (
              <Card key={liq.id} className="border-slate-200 hover:shadow-md transition-shadow">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-slate-800 leading-tight">{liq.employee.name}</p>
                      <p className="text-xs text-slate-500">{liq.employee.position} · CC {liq.employee.document}</p>
                    </div>
                    <span className="text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full font-medium whitespace-nowrap ml-2">Liquidado</span>
                  </div>
                  <div className="space-y-1 text-sm text-slate-600">
                    <div className="flex justify-between"><span>Fecha retiro</span><span className="font-medium text-slate-800">{formatDate(liq.terminationDate)}</span></div>
                    <div className="flex justify-between"><span>Motivo</span><span className="font-medium text-slate-800 text-right max-w-[55%]">{REASON_LABELS[liq.reason] ?? liq.reason}</span></div>
                    <div className="flex justify-between"><span>Salario base</span><span>{formatCurrency(liq.baseSalary)}</span></div>
                  </div>
                  <div className="mt-3 pt-3 border-t space-y-1 text-xs text-slate-500">
                    <div className="flex justify-between"><span>Cesantías + Int.</span><span>{formatCurrency(liq.totalSeverance + liq.totalInterests)}</span></div>
                    <div className="flex justify-between"><span>Prima</span><span>{formatCurrency(liq.totalPremium)}</span></div>
                    <div className="flex justify-between"><span>Vacaciones</span><span>{formatCurrency(liq.totalVacations)}</span></div>
                    {liq.totalIndemnity > 0 && (
                      <div className="flex justify-between text-rose-600 font-medium"><span>Indemnización</span><span>{formatCurrency(liq.totalIndemnity)}</span></div>
                    )}
                  </div>
                  <div className="mt-3 pt-3 border-t flex justify-between items-center">
                    <span className="text-sm font-semibold text-slate-700">Total</span>
                    <span className="text-lg font-bold text-slate-900">{formatCurrency(liq.netPay)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
