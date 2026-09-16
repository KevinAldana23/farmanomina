import { getPayrollInitialData, getAllEmployeesForLiquidation, getFinalLiquidationsHistory } from '../actions/payrollActions';
import LiquidationCalculator from './LiquidationCalculator';

export default async function LiquidacionPage() {
  const { configs } = await getPayrollInitialData();
  const employees = await getAllEmployeesForLiquidation();
  const liquidationsHistory = await getFinalLiquidationsHistory();

  if (!configs || configs.length === 0) {
    return <div>Falta configuración legal. Por favor ingresa a Configuración primero.</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto print:p-0">
      <div className="mb-6 print:hidden">
        <h1 className="text-3xl font-bold tracking-tight">Liquidación Definitiva</h1>
        <p className="text-muted-foreground mt-1">
          Calcula el pago de salarios pendientes, proporcionales de prestaciones y vacaciones ante el retiro de un empleado.
        </p>
      </div>
      
      <LiquidationCalculator employees={employees} configs={configs} liquidationsHistory={liquidationsHistory} />
    </div>
  );
}
