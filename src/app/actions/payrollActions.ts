'use server';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function getPayrollInitialData() {
  const employees = await prisma.employee.findMany({
    where: { 
      isActive: true,
      finalLiquidation: null
    },
    orderBy: { name: 'asc' }
  });
  
  const configs = await prisma.legalConfig.findMany({
    orderBy: { validFrom: 'desc' }
  });

  const payrollPeriods = await prisma.payrollPeriod.findMany({
    orderBy: { startDate: 'desc' },
    include: { payrollRecords: true }
  });

  return { employees, configs, payrollPeriods };
}

export async function getAllEmployeesForLiquidation() {
  // Devuelve TODOS los empleados (activos e inactivos) con su liquidación incluida
  return await prisma.employee.findMany({
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    include: { finalLiquidation: true }
  });
}

export async function getFinalLiquidationsHistory() {
  return await prisma.finalLiquidation.findMany({
    orderBy: { terminationDate: 'desc' },
    include: { employee: true }
  });
}

export interface HistoricalAveragesResult {
  hasHistory: boolean;
  periodsEvaluatedYear: number;
  periodsEvaluatedSemester: number;
  suggestedSeveranceBase: number;
  suggestedPremiumBase: number;
  suggestedVacationBase: number;
  breakdown: {
    baseSalary: number;
    appliesTransport: boolean;
    auxilioTransporte: number;
    totalNightSurchargesYear: number;
    totalRecargosYear: number;
    totalCommissionsYear: number;
    averageMonthlyVariableSeverance: number;
    averageMonthlyNightSurcharges: number;
    totalRecargosSemester: number;
    totalCommissionsSemester: number;
    averageMonthlyVariablePremium: number;
  };
}

/**
 * Consulta el historial de nóminas pagadas para calcular los promedios salariales variables
 * conforme a los artículos 192, 253 y 306 del Código Sustantivo del Trabajo (CST).
 */
export async function getEmployeeHistoricalAverages(
  employeeId: string,
  terminationDateStr: string
): Promise<HistoricalAveragesResult> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: {
      payrollRecords: {
        include: { period: true },
        orderBy: { period: { startDate: 'desc' } }
      }
    }
  });

  const configs = await prisma.legalConfig.findMany({
    orderBy: { validFrom: 'desc' }
  });

  const termDate = new Date(terminationDateStr);
  const activeConfig = configs.find(c => new Date(c.validFrom) <= termDate) || configs[0];
  const configData = activeConfig 
    ? JSON.parse(activeConfig.configData) 
    : { smmlv: 1750905, auxilioTransporte: 249095, topeAuxilioTransporteEnSMMLV: 2 };

  const baseSalary = employee?.baseSalary || 0;
  const appliesTransport = !employee?.isIntegralSalary && baseSalary <= (configData.smmlv * (configData.topeAuxilioTransporteEnSMMLV || 2));
  const auxilioTransporte = appliesTransport ? configData.auxilioTransporte : 0;

  if (!employee || !employee.payrollRecords || employee.payrollRecords.length === 0) {
    return {
      hasHistory: false,
      periodsEvaluatedYear: 0,
      periodsEvaluatedSemester: 0,
      suggestedSeveranceBase: Math.round(baseSalary + auxilioTransporte),
      suggestedPremiumBase: Math.round(baseSalary + auxilioTransporte),
      suggestedVacationBase: Math.round(baseSalary),
      breakdown: {
        baseSalary,
        appliesTransport,
        auxilioTransporte,
        totalNightSurchargesYear: 0,
        totalRecargosYear: 0,
        totalCommissionsYear: 0,
        averageMonthlyVariableSeverance: 0,
        averageMonthlyNightSurcharges: 0,
        totalRecargosSemester: 0,
        totalCommissionsSemester: 0,
        averageMonthlyVariablePremium: 0
      }
    };
  }

  const oneYearAgo = new Date(termDate);
  oneYearAgo.setDate(oneYearAgo.getDate() - 360);

  const termYear = termDate.getFullYear();
  const termMonth = termDate.getMonth();
  const semesterStart = termMonth >= 6 ? new Date(termYear, 6, 1) : new Date(termYear, 0, 1);

  // Filtrar registros del último año (máx 360 días)
  const yearRecords = employee.payrollRecords.filter(r => {
    const pEnd = new Date(r.period.endDate);
    const pStart = new Date(r.period.startDate);
    return pEnd >= oneYearAgo && pStart <= termDate;
  });

  // Filtrar registros del semestre en curso
  const semesterRecords = employee.payrollRecords.filter(r => {
    const pEnd = new Date(r.period.endDate);
    const pStart = new Date(r.period.startDate);
    return pEnd >= semesterStart && pStart <= termDate;
  });

  let daysWorkedYear = 0;
  let totalNightSurchargesYear = 0;
  let totalRecargosYear = 0;
  let totalCommissionsYear = 0;

  for (const r of yearRecords) {
    daysWorkedYear += r.daysWorked;
    try {
      const calc = JSON.parse(r.calculations);
      const dev = calc.devengado || {};
      const rec = dev.recargos || {};
      totalNightSurchargesYear += Number(rec.recargoNocturno) || 0;
      totalRecargosYear += Number(dev.totalRecargos) || 0;
      totalCommissionsYear += Number(dev.otherIncomes) || 0;
    } catch {
      // Si cálculo no es JSON válido, continúa
    }
  }

  let daysWorkedSemester = 0;
  let totalRecargosSemester = 0;
  let totalCommissionsSemester = 0;

  for (const r of semesterRecords) {
    daysWorkedSemester += r.daysWorked;
    try {
      const calc = JSON.parse(r.calculations);
      const dev = calc.devengado || {};
      totalRecargosSemester += Number(dev.totalRecargos) || 0;
      totalCommissionsSemester += Number(dev.otherIncomes) || 0;
    } catch {
      // continúa
    }
  }

  // Promedio mensual = (Total Variable / Días Trabajados) * 30
  const averageMonthlyVariableSeverance = daysWorkedYear > 0
    ? (totalRecargosYear + totalCommissionsYear) / daysWorkedYear * 30
    : 0;

  const averageMonthlyNightSurcharges = daysWorkedYear > 0
    ? totalNightSurchargesYear / daysWorkedYear * 30
    : 0;

  const averageMonthlyCommissionsYear = daysWorkedYear > 0
    ? totalCommissionsYear / daysWorkedYear * 30
    : 0;

  const averageMonthlyVariablePremium = daysWorkedSemester > 0
    ? (totalRecargosSemester + totalCommissionsSemester) / daysWorkedSemester * 30
    : 0;

  // Bases sugeridas según CST:
  // 1. Cesantías (Art. 253 CST): Salario básico + promedio variable anual + auxilio de transporte
  const suggestedSeveranceBase = Math.round(baseSalary + averageMonthlyVariableSeverance + auxilioTransporte);
  // 2. Prima (Art. 306 CST): Salario básico + promedio variable semestral + auxilio de transporte
  const suggestedPremiumBase = Math.round(baseSalary + averageMonthlyVariablePremium + auxilioTransporte);
  // 3. Vacaciones (Art. 192 CST): Salario ordinario + recargo nocturno promediado + comisiones (SIN horas extras y SIN auxilio)
  const suggestedVacationBase = Math.round(baseSalary + averageMonthlyNightSurcharges + averageMonthlyCommissionsYear);

  return {
    hasHistory: yearRecords.length > 0 || semesterRecords.length > 0,
    periodsEvaluatedYear: yearRecords.length,
    periodsEvaluatedSemester: semesterRecords.length,
    suggestedSeveranceBase,
    suggestedPremiumBase,
    suggestedVacationBase,
    breakdown: {
      baseSalary,
      appliesTransport,
      auxilioTransporte,
      totalNightSurchargesYear: Math.round(totalNightSurchargesYear),
      totalRecargosYear: Math.round(totalRecargosYear),
      totalCommissionsYear: Math.round(totalCommissionsYear),
      averageMonthlyVariableSeverance: Math.round(averageMonthlyVariableSeverance),
      averageMonthlyNightSurcharges: Math.round(averageMonthlyNightSurcharges),
      totalRecargosSemester: Math.round(totalRecargosSemester),
      totalCommissionsSemester: Math.round(totalCommissionsSemester),
      averageMonthlyVariablePremium: Math.round(averageMonthlyVariablePremium)
    }
  };
}


export async function saveFinalLiquidation(data: {
  employeeId: string;
  terminationDate: string;
  reason: string;
  baseSalary: number;
  totalSeverance: number;
  totalInterests: number;
  totalPremium: number;
  totalVacations: number;
  totalIndemnity: number;
  netPay: number;
  calculations: Record<string, unknown> | object;
}) {

  const res = await prisma.$transaction(async (tx) => {

    // Crear el registro de liquidación
    const liquidation = await tx.finalLiquidation.create({
      data: {
        employeeId: data.employeeId,
        terminationDate: new Date(data.terminationDate),
        reason: data.reason,
        baseSalary: data.baseSalary,
        totalSeverance: data.totalSeverance,
        totalInterests: data.totalInterests,
        totalPremium: data.totalPremium,
        totalVacations: data.totalVacations,
        totalIndemnity: data.totalIndemnity,
        netPay: data.netPay,
        calculations: JSON.stringify(data.calculations)
      }
    });

    // Inactivar al empleado y establecer su fecha de retiro
    await tx.employee.update({
      where: { id: data.employeeId },
      data: {
        isActive: false,
        terminationDate: new Date(data.terminationDate)
      }
    });

    return liquidation;
  });

  revalidatePath('/');
  revalidatePath('/empleados');
  revalidatePath('/nomina');
  revalidatePath('/liquidacion');
  revalidatePath('/reportes');
  revalidatePath('/auditoria');

  return res;
}

export async function getAuditModuleData() {
  const [liquidations, employees, configs] = await Promise.all([
    prisma.finalLiquidation.findMany({
      orderBy: { terminationDate: 'desc' },
      include: {
        employee: true,
      },
    }),
    prisma.employee.findMany({
      orderBy: { name: 'asc' },
      include: {
        payrollRecords: {
          include: {
            period: true,
          },
          orderBy: {
            period: {
              startDate: 'desc',
            },
          },
        },
        finalLiquidation: true,
      },
    }),
    prisma.legalConfig.findMany({
      orderBy: { validFrom: 'desc' },
    }),
  ]);

  return { liquidations, employees, configs };
}
