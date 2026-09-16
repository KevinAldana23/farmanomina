import { getEmployees } from '../actions/employeeActions';
import EmployeeTable from './EmployeeTable';

export default async function EmpleadosPage() {
  const employees = await getEmployees();

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Directorio de Colaboradores</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Gestiona la información del personal de la farmacia.
          </p>
        </div>
      </div>
      
      <EmployeeTable initialEmployees={employees} />
    </div>
  );
}
