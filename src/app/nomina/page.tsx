import { getPayrollInitialData } from '../actions/payrollActions';
import PayrollCalculator from './PayrollCalculator';

export default async function NominaPage() {
  const { employees, configs } = await getPayrollInitialData();

  if (!configs || configs.length === 0) {
    return <div>Falta configuración legal. Por favor ingresa a Configuración primero.</div>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto print:p-0">
      <div className="mb-6 print:hidden">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Liquidar Nómina</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          Ingresa las novedades (días, horas extras, recargos) y visualiza el cálculo de inmediato.
        </p>
      </div>
      
      <PayrollCalculator employees={employees} configs={configs} />
    </div>
  );
}
