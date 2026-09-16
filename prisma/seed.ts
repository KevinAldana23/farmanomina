import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const mockConfigData = {
  smmlv: 1750905,
  auxilioTransporte: 249095,
  topeAuxilioTransporteEnSMMLV: 2,
  jornada: {
    horasSemanales: 42,
    divisorHoraOrdinaria: 210,
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
    dominicalFestivoDiurno: 0.90, // 90% para Julio 2026 - Junio 2027
    dominicalFestivoNocturno: 1.25,
    extraDiurnaDominicalFestivo: 2.15,
    extraNocturnaDominicalFestivo: 2.65
  },
  topesIBC: { minEnSMMLV: 1, maxEnSMMLV: 25 },
  exoneracionParafiscales: { aplicaPorDefecto: true, topeEnSMMLV: 10 }
};

async function main() {
  console.log('Seeding database...');

  // 1. Legal Config (Vigente a partir de Julio 2026: 42h, divisor 210, recargo dominical 90%)
  await prisma.legalConfig.create({
    data: {
      validFrom: new Date('2026-07-01T00:00:00.000Z'),
      configData: JSON.stringify(mockConfigData)
    }
  });

  // 2. Employees (1 empleado de prueba)
  const employees = [
    { name: 'Ana Gómez', document: '101010101', position: 'Director técnico / Regente', baseSalary: 2600000, arlRiskClass: 'I', contractType: 'Indefinido' },
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

  // 3. Admin User
  const hashedPassword = await bcrypt.hash('Admin2026*', 10);
  await prisma.user.upsert({
    where: { email: 'admin@farmacia.com' },
    update: {
      password: hashedPassword,
    },
    create: {
      email: 'admin@farmacia.com',
      name: 'Administradora',
      password: hashedPassword,
      role: 'admin',
    },
  });

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
