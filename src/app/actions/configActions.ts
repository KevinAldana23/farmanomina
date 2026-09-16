'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function getLegalConfigs() {
  return await prisma.legalConfig.findMany({
    orderBy: { validFrom: 'desc' }
  });
}

export async function saveLegalConfig(id: string, rawConfigData: string) {
  try {
    // Validate JSON
    JSON.parse(rawConfigData);
  } catch {
    throw new Error("Invalid JSON format");
  }


  await prisma.legalConfig.update({
    where: { id },
    data: { configData: rawConfigData }
  });
  
  revalidatePath('/configuracion');
}
