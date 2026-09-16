import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const mockConfigData = {
  smmlv: 1750905,
  auxilioTransporte: 249095,
  topeAuxilioTransporteEnSMMLV: 2,
  jornada: {
    horasSemanales: 44,
    divisorHoraOrdinaria: 220,
    horaInicioNocturno: '19:00',
    horaFinNocturno: '06:00'
  },
  aportes: {
    saludEmpleado: 0.04,
    pensionEmpleado: 0.04,
    saludEmpleador: 0.085,
    pensionEmpleador: 0.12,
    cajaCompensacion: 0.04,
    sena: 0.02,
    icbf: 0.03,
    arlPorClase: { "I": 0.00522, "II": 0.01044, "III": 0.02436, "IV": 0.0435, "V": 0.0696 }
  },
  provisiones: {
    cesantias: 0.0833,
    interesesCesantias: 0.01,
    prima: 0.0833,
    vacaciones: 0.0417
  },
  fondoSolidaridad: {
    topeEnSMMLV: 4,
    porcentajePorRango: [
      { min: 4, max: 16, pct: 0.01 },
      { min: 16, max: 17, pct: 0.012 },
    ]
  },
  recargosYExtras: {
    recargoNocturno: 0.35,
    horaExtraDiurna: 0.25,
    horaExtraNocturna: 0.75,
    dominicalFestivoDiurno: 0.90, // 90% para 2026-2027
    dominicalFestivoNocturno: 1.25,
    extraDiurnaDominicalFestivo: 2.15,
    extraNocturnaDominicalFestivo: 2.65
  },
  topesIBC: { minEnSMMLV: 1, maxEnSMMLV: 25 },
  exoneracionParafiscales: { aplicaPorDefecto: true, topeEnSMMLV: 10 }
};

async function main() {
  console.log('Seeding database...');

  // 1. Legal Config
  await prisma.legalConfig.create({
    data: {
      validFrom: new Date('2026-01-01T00:00:00.000Z'),
      configData: JSON.stringify(mockConfigData)
    }
  });

  // 2. Employees
  const employees = [
    { name: 'Ana Gómez', document: '101010101', position: 'Director técnico / Regente', baseSalary: 2600000, arlRiskClass: 'I', contractType: 'Indefinido' },
    { name: 'Carlos Díaz', document: '102020202', position: 'Administrador', baseSalary: 2200000, arlRiskClass: 'I', contractType: 'Indefinido' },
    ...Array.from({ length: 10 }).map((_, i) => ({
      name: `Auxiliar ${i + 1}`, document: `20000000${i}`, position: 'Auxiliar de Droguería', baseSalary: 1750905, arlRiskClass: 'I', contractType: 'Fijo'
    })),
    ...Array.from({ length: 3 }).map((_, i) => ({
      name: `Cajero ${i + 1}`, document: `30000000${i}`, position: 'Cajero', baseSalary: 1750905, arlRiskClass: 'I', contractType: 'Fijo'
    })),
    ...Array.from({ length: 3 }).map((_, i) => ({
      name: `Domiciliario ${i + 1}`, document: `40000000${i}`, position: 'Domiciliario', baseSalary: 1800000, arlRiskClass: 'IV', contractType: 'Fijo'
    })),
  ];

  for (const emp of employees) {
    await prisma.employee.create({
      data: {
        document: emp.document,
        name: emp.name,
        position: emp.position,
        hireDate: new Date('2025-01-01T00:00:00.000Z'),
        contractType: emp.contractType,
        baseSalary: emp.baseSalary,
        arlRiskClass: emp.arlRiskClass,
      }
    });
  }

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
