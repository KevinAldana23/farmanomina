'use server';
import { PrismaClient } from '@prisma/client';
import { revalidatePath } from 'next/cache';

const prisma = new PrismaClient();

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

  return res;
}
