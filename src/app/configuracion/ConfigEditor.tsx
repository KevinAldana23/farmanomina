'use client';

import { useState } from 'react';
import { LegalConfig } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveLegalConfig } from '../actions/configActions';

export default function ConfigEditor({ config }: { config: LegalConfig }) {
  const [loading, setLoading] = useState(false);
  const data = JSON.parse(config.configData);
  
  const [smmlv, setSmmlv] = useState(data.smmlv);
  const [auxilio, setAuxilio] = useState(data.auxilioTransporte);
  const [divisor, setDivisor] = useState(data.jornada.divisorHoraOrdinaria);
  const [horasSemanales, setHorasSemanales] = useState(data.jornada.horasSemanales);
  const [recargoDominical, setRecargoDominical] = useState(
    Math.round((data.recargosYExtras?.dominicalFestivoDiurno ?? 0.9) * 100)
  );

  const validDate = new Date(config.validFrom);
  
  const getPeriodInfo = () => {
    if (validDate >= new Date('2027-07-01')) {
      return {
        title: 'A partir de Julio 2027',
        badge: 'Jornada 42h | Recargo Dominical 100%',
        badgeColor: 'bg-emerald-100 text-emerald-800',
        festivoNote: 'El recargo llega al 100% definitivo (pago doble)'
      };
    } else if (validDate >= new Date('2026-07-01')) {
      return {
        title: 'Julio 2026 a Junio 2027',
        badge: 'Jornada 42h | Recargo Dominical 90%',
        badgeColor: 'bg-purple-100 text-purple-800',
        festivoNote: 'El recargo sube al 90%'
      };
    } else {
      return {
        title: 'Enero 2026 a Junio 2026',
        badge: 'Jornada 44h | Recargo Dominical 80%',
        badgeColor: 'bg-blue-100 text-blue-800',
        festivoNote: 'El recargo aplica al 80%'
      };
    }
  };

  const periodInfo = getPeriodInfo();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const updatedData = {
      ...data,
      smmlv: Number(smmlv),
      auxilioTransporte: Number(auxilio),
      jornada: {
        ...data.jornada,
        divisorHoraOrdinaria: Number(divisor),
        horasSemanales: Number(horasSemanales)
      },
      recargosYExtras: {
        ...data.recargosYExtras,
        dominicalFestivoDiurno: Number(recargoDominical) / 100
      }
    };

    try {
      await saveLegalConfig(config.id, JSON.stringify(updatedData, null, 2));
      alert('Configuración guardada correctamente');
    } catch (error) {
      console.error(error);
      alert('Error guardando la configuración');
    } finally {

      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl bg-white p-4 sm:p-6 rounded-lg shadow-sm border">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900">
            {periodInfo.title}
          </h3>
          <p className="text-xs text-muted-foreground">
            Aplica automáticamente si la fecha de liquidación es a partir del {validDate.toLocaleDateString('es-CO')}.
          </p>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold self-start sm:self-auto ${periodInfo.badgeColor}`}>
          {periodInfo.badge}
        </span>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Salario Mínimo (SMMLV)</Label>
          <Input type="number" value={smmlv} onChange={(e) => setSmmlv(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Auxilio de Transporte</Label>
          <Input type="number" value={auxilio} onChange={(e) => setAuxilio(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Horas de Jornada Semanal</Label>
          <Input type="number" value={horasSemanales} onChange={(e) => setHorasSemanales(e.target.value)} required />
          <span className="text-[11px] text-muted-foreground">
            {horasSemanales <= 42 ? 'Jornada reducida a 42h' : 'Jornada de 44h'}
          </span>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Divisor Mes</Label>
          <Input type="number" value={divisor} onChange={(e) => setDivisor(e.target.value)} required />
          <span className="text-[11px] text-muted-foreground">
            Divisor {divisor}
          </span>
        </div>
        <div className="space-y-2 col-span-1 sm:col-span-2">
          <Label className="text-xs font-semibold">Recargo Dominical / Festivo (%)</Label>
          <div className="flex items-center gap-2">
            <Input 
              type="number" 
              value={recargoDominical} 
              onChange={(e) => setRecargoDominical(Number(e.target.value))} 
              className="max-w-[120px]"
              min="0" 
              max="150"
              required 
            />
            <span className="text-sm font-medium text-slate-700">%</span>
            <span className="text-xs text-muted-foreground ml-2">
              {periodInfo.festivoNote}
            </span>
          </div>
        </div>
      </div>

      <div className="pt-2 flex justify-end">
        <Button type="submit" disabled={loading} className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800">
          {loading ? 'Guardando...' : 'Guardar Cambios'}
        </Button>
      </div>
    </form>
  );
}
