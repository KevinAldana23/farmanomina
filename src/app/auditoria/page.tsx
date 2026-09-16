import { getAuditModuleData } from '../actions/payrollActions';
import AuditDashboard from './AuditDashboard';

export const dynamic = 'force-dynamic';

export default async function AuditoriaPage() {
  const { liquidations, employees } = await getAuditModuleData();

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <AuditDashboard 
        liquidations={liquidations} 
        employees={employees} 
      />
    </div>
  );
}
