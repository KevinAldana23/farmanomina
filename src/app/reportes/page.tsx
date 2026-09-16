import { getPayrollInitialData, getAllEmployeesForLiquidation, getFinalLiquidationsHistory } from '../actions/payrollActions';
import ReportGenerator from './ReportGenerator';

export default async function ReportesPage() {
  const { employees, configs, payrollPeriods } = await getPayrollInitialData();
  const allEmployees = await getAllEmployeesForLiquidation();
  const liquidationsHistory = await getFinalLiquidationsHistory();

  if (!configs || configs.length === 0) {
    return <div>Falta configuración legal. Por favor ingresa a Configuración primero.</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Reportes y Exportación</h1>
        <p className="text-muted-foreground mt-1">
          Genera archivos para transferencias bancarias y descarga la sábana de nómina o historial de liquidaciones en Excel/CSV.
        </p>
      </div>
      
      <ReportGenerator 
        employees={employees} 
        allEmployees={allEmployees}
        configs={configs} 
        payrollPeriods={payrollPeriods} 
        liquidationsHistory={liquidationsHistory}
      />
    </div>
  );
}

