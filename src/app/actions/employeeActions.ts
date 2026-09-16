'use server';

import { PrismaClient } from '@prisma/client';
import { revalidatePath } from 'next/cache';

const prisma = new PrismaClient();

export async function getEmployees() {
  return await prisma.employee.findMany({
    orderBy: { name: 'asc' },
    include: { finalLiquidation: true }
  });
}

export async function deleteEmployee(id: string) {
  await prisma.employee.delete({
    where: { id }
  });
  revalidatePath('/');
  revalidatePath('/empleados');
  revalidatePath('/nomina');
  revalidatePath('/reportes');
  revalidatePath('/liquidacion');
}

export interface EmployeeInputData {
  id?: string;
  document: string;
  name: string;
  position: string;
  hireDate: string | Date;
  contractType: string;
  baseSalary: number | string;
  isIntegralSalary?: boolean | string;
  arlRiskClass: string;
  bankName?: string | null;
  bankAccount?: string | null;
  isActive: boolean | string;
}

export async function saveEmployee(data: EmployeeInputData) {
  const isUpdate = !!data.id;
  const isActiveBool = data.isActive === 'Activo' || data.isActive === 'true' || data.isActive === true;


  const payload = {
    document: data.document,
    name: data.name,
    position: data.position,
    hireDate: new Date(data.hireDate),
    contractType: data.contractType,
    baseSalary: Number(data.baseSalary),
    isIntegralSalary: data.isIntegralSalary === 'true' || data.isIntegralSalary === true,
    arlRiskClass: data.arlRiskClass,
    bankName: data.bankName || null,
    bankAccount: data.bankAccount || null,
    isActive: isActiveBool,
  };

  let saved;
  if (isUpdate) {
    saved = await prisma.employee.update({
      where: { id: data.id },
      data: payload
    });
  } else {
    saved = await prisma.employee.create({
      data: payload
    });
  }
  revalidatePath('/');
  revalidatePath('/empleados');
  revalidatePath('/nomina');
  revalidatePath('/reportes');
  revalidatePath('/liquidacion');
  return saved;
}


