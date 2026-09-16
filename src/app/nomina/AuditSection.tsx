'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';

interface AuditProps {
  calculatedNetPay: number;
  calculatedSocial: number;
  exonerated: boolean;
}

export default function AuditSection({ calculatedNetPay, calculatedSocial, exonerated }: AuditProps) {
  const [reportedNetPay, setReportedNetPay] = useState<number | ''>('');
  const [reportedSocial, setReportedSocial] = useState<number | ''>('');

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

  const evaluateDifference = (reported: number, calculated: number) => {
    if (!reported) return null;
    const diff = Math.abs(reported - calculated);
    const diffPercent = calculated > 0 ? (diff / calculated) * 100 : 0;

    if (diff <= 2000) {
      return { status: 'green', text: 'Coincide', diff };
    } else if (diffPercent <= 4) {
      return { status: 'yellow', text: 'Diferencia Menor', diff };
    } else {
      return { status: 'red', text: 'Diferencia Mayor', diff };
    }
  };

  const netPayEval = evaluateDifference(Number(reportedNetPay) || 0, calculatedNetPay);
  const socialEval = evaluateDifference(Number(reportedSocial) || 0, calculatedSocial);

  const renderStatusIcon = (status: string) => {
    if (status === 'green') return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
    if (status === 'yellow') return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    return <AlertCircle className="h-5 w-5 text-rose-500" />;
  };

  // Diagnóstico
  const renderDiagnostics = () => {
    const causes = [];
    if (socialEval && socialEval.status !== 'green') {
      if (exonerated && Number(reportedSocial) > calculatedSocial) {
        causes.push('Posible cobro de SENA/ICBF/Salud Patronal pese a que el empleado aplica para exoneración (Art. 114-1 E.T.).');
      }
      causes.push('Verificar si se está usando el riesgo ARL correcto para la clase de riesgo del empleado.');
    }
    
    if (netPayEval && netPayEval.status !== 'green') {
      causes.push('Diferencias en el cálculo de horas extras o recargos (posible uso de un divisor de jornada anterior).');
      causes.push('Verificar si se aplicó auxilio de transporte incorrectamente o se sumó a la base de deducciones.');
    }

    if (causes.length === 0) return null;

    return (
      <div className="mt-4 p-3 bg-slate-50 border rounded-md text-sm">
        <h5 className="font-semibold mb-2 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" /> Posibles causas de la diferencia:
        </h5>
        <ul className="list-disc pl-5 space-y-1 text-slate-600">
          {causes.map((c, i) => <li key={i}>{c}</li>)}
        </ul>
      </div>
    );
  };

  return (
    <Card className="mt-6 border-slate-300 shadow-sm">
      <CardHeader className="bg-slate-100 pb-4 border-b">
        <CardTitle className="text-slate-800 text-lg">
          Auditoría &ldquo;Control Contadora&rdquo;
        </CardTitle>

      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <Label className="text-slate-600">Neto a Pagar Reportado</Label>
              <Input 
                type="number" 
                value={reportedNetPay} 
                onChange={(e) => setReportedNetPay(Number(e.target.value))}
                placeholder="Ej. 1800000"
                className="mt-1"
              />
              {netPayEval && reportedNetPay && (
                <div className={`mt-2 flex items-center gap-2 font-medium ${
                  netPayEval.status === 'green' ? 'text-emerald-600' : 
                  netPayEval.status === 'yellow' ? 'text-amber-600' : 'text-rose-600'
                }`}>
                  {renderStatusIcon(netPayEval.status)}
                  <span>Diferencia: {formatCurrency(netPayEval.diff)}</span>
                </div>
              )}
            </div>
            
            <div>
              <Label className="text-slate-600">Total Seguridad Social (PILA)</Label>
              <Input 
                type="number" 
                value={reportedSocial} 
                onChange={(e) => setReportedSocial(Number(e.target.value))}
                placeholder="Ej. 500000"
                className="mt-1"
              />
              {socialEval && reportedSocial && (
                <div className={`mt-2 flex items-center gap-2 font-medium ${
                  socialEval.status === 'green' ? 'text-emerald-600' : 
                  socialEval.status === 'yellow' ? 'text-amber-600' : 'text-rose-600'
                }`}>
                  {renderStatusIcon(socialEval.status)}
                  <span>Diferencia: {formatCurrency(socialEval.diff)}</span>
                </div>
              )}
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold text-slate-700 mb-2 border-b pb-1">Cálculo del Sistema</h4>
            <div className="space-y-2 text-sm pt-2">
              <div className="flex justify-between">
                <span className="text-slate-600">Neto a Pagar:</span>
                <span className="font-medium">{formatCurrency(calculatedNetPay)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Seguridad Social (PILA):</span>
                <span className="font-medium">{formatCurrency(calculatedSocial)}</span>
              </div>
              <p className="text-xs text-muted-foreground pt-1 border-t mt-2">
                * PILA incluye aportes patronales ({formatCurrency(calculatedSocial - calculatedNetPay)}) + deducciones del empleado. (Simplificado para este ejemplo).
              </p>
            </div>
          </div>
        </div>

        {renderDiagnostics()}
      </CardContent>
    </Card>
  );
}
