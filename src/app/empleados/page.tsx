import { getEmployees } from '../actions/employeeActions';
import EmployeeTable from './EmployeeTable';

export default async function EmpleadosPage() {
  const employees = await getEmployees();

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Directorio de Colaboradores</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona la información del personal de la farmacia.
          </p>
        </div>
      </div>
      
      <EmployeeTable initialEmployees={employees} />
    </div>
  );
}
