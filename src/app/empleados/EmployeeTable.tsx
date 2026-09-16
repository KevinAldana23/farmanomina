'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { Trash2, Edit, Plus } from 'lucide-react';
import { deleteEmployee, getEmployees } from '../actions/employeeActions';
import EmployeeForm from './EmployeeForm';

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
  finalLiquidation: { id: string; terminationDate: Date; reason: string; netPay: number } | null;
};

export default function EmployeeTable({ initialEmployees }: { initialEmployees: EmployeeWithLiquidation[] }) {
  const router = useRouter();
  const [employees, setEmployees] = useState<EmployeeWithLiquidation[]>(initialEmployees);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeWithLiquidation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmployeeWithLiquidation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [prevInitial, setPrevInitial] = useState(initialEmployees);

  if (prevInitial !== initialEmployees) {
    setPrevInitial(initialEmployees);
    setEmployees(initialEmployees);
  }

  const confirmDelete = async () => {

    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteEmployee(deleteTarget.id);
      setEmployees(prev => prev.filter(e => e.id !== deleteTarget.id));
      setDeleteTarget(null);
      router.refresh();
    } catch (err) {
      console.error(err);
      alert('Error al eliminar el colaborador.');
    } finally {
      setIsDeleting(false);
    }
  };


  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
  };

  const openCreateDialog = () => {
    setEditingEmployee(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (employee: EmployeeWithLiquidation) => {

    setEditingEmployee(employee);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingEmployee(null);
  };

  const handleSuccess = async () => {
    setIsDialogOpen(false);
    setEditingEmployee(null);
    try {
      const updated = await getEmployees();
      setEmployees(updated);
    } catch (e) {
      console.error(e);
    }
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo Empleado
        </Button>
      </div>
      
      <div className="rounded-md border bg-card text-card-foreground shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Salario Base</TableHead>
              <TableHead>Contrato</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map((emp) => (
              <TableRow key={emp.id}>
                <TableCell className="font-medium">{emp.name}</TableCell>
                <TableCell>{emp.document}</TableCell>
                <TableCell>{emp.position}</TableCell>
                <TableCell>{formatCurrency(emp.baseSalary)}</TableCell>
                <TableCell className="capitalize">{emp.contractType}</TableCell>
                <TableCell>
                  {emp.finalLiquidation ? (
                    <Badge className="bg-red-100 text-red-700 border border-red-200 hover:bg-red-100">
                      🔴 Liquidado
                    </Badge>
                  ) : (
                    <Badge variant={emp.isActive ? "default" : "secondary"}>
                      {emp.isActive ? "Activo" : "Inactivo"}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" title="Editar" onClick={() => openEditDialog(emp)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" title="Eliminar" onClick={() => setDeleteTarget(emp)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {employees.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                  No hay empleados registrados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal de Crear / Editar Empleado */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingEmployee ? 'Editar Empleado' : 'Nuevo Empleado'}</DialogTitle>
          </DialogHeader>
          <EmployeeForm 
            employee={editingEmployee} 
            onSuccess={handleSuccess} 
            onCancel={closeDialog} 
          />
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmación para Eliminar Colaborador */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Eliminar colaborador?</DialogTitle>
            <DialogDescription className="pt-2 text-slate-600">
              ¿Estás seguro de que deseas eliminar del sistema a <strong>{deleteTarget?.name}</strong> (CC {deleteTarget?.document})?
              <br /><br />
              <span className="text-xs text-red-600 font-medium">
                Esta acción borrará el registro del colaborador y no se puede deshacer.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-end mt-4">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button 
              type="button" 
              variant="destructive" 
              className="bg-red-600 hover:bg-red-700 text-white" 
              disabled={isDeleting}
              onClick={confirmDelete}
            >
              {isDeleting ? 'Eliminando...' : 'Eliminar Colaborador'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

