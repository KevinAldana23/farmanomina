'use server';

import { prisma } from '@/lib/prisma';
import { calculatePayroll, PayrollNovedades, LegalConfig as ParsedConfig } from '@/lib/payrollEngine';
import { revalidatePath } from 'next/cache';

export async function savePayrollPeriodAction(data: {
  startDate: string;
  endDate: string;
  isQuincenal: boolean;
  novedadesMap: Record<string, PayrollNovedades>;
}) {
  const { startDate, endDate, isQuincenal, novedadesMap } = data;
  
  const sDate = new Date(startDate);
  const eDate = new Date(endDate);

  // Get employees and config (solo colaboradores activos que no han sido liquidados)
  const employees = await prisma.employee.findMany({ 
    where: { 
      isActive: true,
      finalLiquidation: null
    } 
  });
  const configs = await prisma.legalConfig.findMany({ orderBy: { validFrom: 'desc' } });
  
  const activeConfig = configs.find(c => new Date(c.validFrom) <= eDate) || configs[configs.length - 1];
  const parsedConfig: ParsedConfig = {
    validFrom: activeConfig.validFrom.toString(),
    configData: JSON.parse(activeConfig.configData)
  };

  return await prisma.$transaction(async (tx) => {
    const period = await tx.payrollPeriod.create({
      data: {
        startDate: sDate,
        endDate: eDate,
        isQuincenal,
        status: 'closed'
      }
    });

    const records = employees.map(emp => {
      const nov = novedadesMap[emp.id] || {
        daysWorked: isQuincenal ? 15 : 30,
        extraHoursDiurna: 0,
        extraHoursNocturna: 0,
        recargoNocturnoHours: 0,
        dominicalFestivoDiurnoHours: 0,
        dominicalFestivoNocturnoHours: 0,
        extraDiurnaDominicalFestivoHours: 0,
        extraNocturnaDominicalFestivoHours: 0,
        otherIncomes: 0,
        otherDeductions: 0
      };

      const result = calculatePayroll({
        baseSalary: emp.baseSalary,
        isIntegralSalary: emp.isIntegralSalary,
        arlRiskClass: emp.arlRiskClass,
        hireDate: emp.hireDate.toString(),
      }, nov, parsedConfig);

      return {
        employeeId: emp.id,
        periodId: period.id,
        daysWorked: nov.daysWorked,
        novedades: JSON.stringify(nov),
        totalDevengado: result.devengado.totalDevengado,
        totalDeducciones: result.deducciones.totalDeducciones,
        netPay: result.netPay,
        employerCost: result.employer.totalAportes + result.employer.totalProvisiones,
        calculations: JSON.stringify(result)
      };
    });

    await tx.payrollRecord.createMany({ data: records });

    revalidatePath('/');
    revalidatePath('/nomina');
    revalidatePath('/reportes');
    revalidatePath('/auditoria');
    return { success: true, periodId: period.id };

  });
}
