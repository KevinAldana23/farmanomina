'use client';

import { useState } from 'react';
import { Employee } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { saveEmployee } from '../actions/employeeActions';

type EmployeeWithLiquidation = Employee & {
  finalLiquidation?: { id: string; terminationDate: Date; reason: string; netPay: number } | null;
};

interface EmployeeFormProps {
  employee?: EmployeeWithLiquidation | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const REASON_LABELS: Record<string, string> = {
  renuncia: 'Renuncia Voluntaria',
  fin_contrato: 'Fin de Contrato (Fijo)',
  despido_con_justa_causa: 'Despido Con Justa Causa',
  despido_sin_justa_causa: 'Despido Sin Justa Causa',
};

const CONTRACT_TYPES = [
  { value: 'fijo', label: 'Término Fijo' },
  { value: 'indefinido', label: 'Término Indefinido' },
  { value: 'obra', label: 'Obra o Labor' },
];

export default function EmployeeForm({ employee, onSuccess, onCancel }: EmployeeFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    id: employee?.id || '',
    document: employee?.document || '',
    name: employee?.name || '',
    position: employee?.position || '',
    hireDate: employee?.hireDate ? new Date(employee.hireDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    contractType: employee?.contractType ? employee.contractType.toLowerCase() : '',
    baseSalary: employee?.baseSalary?.toString() || '',
    isIntegralSalary: employee?.isIntegralSalary ? 'true' : 'false',
    arlRiskClass: employee?.arlRiskClass || 'I',
    bankName: employee?.bankName || '',
    bankAccount: employee?.bankAccount || '',
    isActive: employee?.isActive !== false ? 'Activo' : 'Inactivo',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await saveEmployee(formData);
      onSuccess();
    } catch (error) {
      console.error(error);
      alert('Error guardando el empleado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Banner de advertencia si ya fue liquidado definitivamente */}
      {employee?.finalLiquidation && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="font-semibold text-amber-800 mb-1">⚠ Colaborador liquidado definitivamente</p>
          <div className="text-sm text-amber-700 space-y-0.5">
            <p>Fecha de retiro: <strong>{new Date(employee.finalLiquidation.terminationDate).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}</strong></p>
            <p>Motivo: <strong>{REASON_LABELS[employee.finalLiquidation.reason] ?? employee.finalLiquidation.reason}</strong></p>
          </div>
          <p className="text-xs text-amber-600 mt-2">Si deseas recontratarlo, actualiza la <strong>Fecha de Ingreso</strong> en este formulario. Esto lo habilitará para nuevas nóminas, pero no eliminará el registro histórico de su liquidación anterior.</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nombre Completo</Label>
          <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="document">Cédula</Label>
          <Input id="document" name="document" value={formData.document} onChange={handleChange} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="position">Cargo</Label>
          <Input id="position" name="position" value={formData.position} onChange={handleChange} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="baseSalary">Salario Base ($)</Label>
          <Input id="baseSalary" name="baseSalary" type="number" value={formData.baseSalary} onChange={handleChange} required min="1" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="hireDate">Fecha de Ingreso</Label>
          <Input id="hireDate" name="hireDate" type="date" value={formData.hireDate} onChange={handleChange} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contractType">Tipo de Contrato</Label>
          <Select value={formData.contractType} onValueChange={(val) => handleSelectChange('contractType', val || '')}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona...">
                {CONTRACT_TYPES.find(c => c.value === formData.contractType?.toLowerCase())?.label}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {CONTRACT_TYPES.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="arlRiskClass">Clase de Riesgo ARL</Label>
          <Select value={formData.arlRiskClass} onValueChange={(val) => handleSelectChange('arlRiskClass', val || 'I')}>
            <SelectTrigger><SelectValue>{formData.arlRiskClass}</SelectValue></SelectTrigger>
            <SelectContent>
              <SelectItem value="I">I (0.522%)</SelectItem>
              <SelectItem value="II">II (1.044%)</SelectItem>
              <SelectItem value="III">III (2.436%)</SelectItem>
              <SelectItem value="IV">IV (4.350%)</SelectItem>
              <SelectItem value="V">V (6.960%)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="isActive">Estado</Label>
          <Select value={formData.isActive} onValueChange={(val) => handleSelectChange('isActive', val || 'Activo')}>
            <SelectTrigger><SelectValue>{formData.isActive}</SelectValue></SelectTrigger>
            <SelectContent>
              <SelectItem value="Activo">Activo</SelectItem>
              <SelectItem value="Inactivo">Inactivo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="bankName">Banco (Opcional)</Label>
          <Input id="bankName" name="bankName" value={formData.bankName} onChange={handleChange} placeholder="Ej: Bancolombia" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bankAccount">No. Cuenta (Opcional)</Label>
          <Input id="bankAccount" name="bankAccount" value={formData.bankAccount} onChange={handleChange} placeholder="Ej: 123456789" />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>Cancelar</Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Guardando...' : 'Guardar Empleado'}
        </Button>
      </div>
    </form>
  );
}
