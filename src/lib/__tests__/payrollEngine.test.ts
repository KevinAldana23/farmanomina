import { describe, it, expect } from 'vitest';
import { calculatePayroll, LegalConfig, EmployeeData, PayrollNovedades } from '../payrollEngine';

const mockConfig: LegalConfig = {
  validFrom: '2026-01-01',
  configData: {
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
      dominicalFestivoDiurno: 0.90,
      dominicalFestivoNocturno: 1.25,
      extraDiurnaDominicalFestivo: 2.15,
      extraNocturnaDominicalFestivo: 2.65
    },
    topesIBC: { minEnSMMLV: 1, maxEnSMMLV: 25 },
    exoneracionParafiscales: { aplicaPorDefecto: true, topeEnSMMLV: 10 }
  }
};

describe('Payroll Engine', () => {
  it('calculates payroll correctly for a minimum wage employee without extras', () => {
    const employee: EmployeeData = {
      baseSalary: 1750905,
      isIntegralSalary: false,
      arlRiskClass: "I",
      hireDate: '2025-01-01'
    };

    const novedades: PayrollNovedades = {
      daysWorked: 30,
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

    const result = calculatePayroll(employee, novedades, mockConfig);

    // Devengado total debe ser SMMLV + Auxilio de transporte
    expect(result.devengado.basicSalaryPeriod).toBeCloseTo(1750905, 0);
    expect(result.devengado.auxilioTransporte).toBeCloseTo(249095, 0);
    expect(result.devengado.totalDevengado).toBeCloseTo(1750905 + 249095, 0);

    // IBC debe ser SMMLV (no incluye auxilio de transporte)
    expect(result.ibc).toBeCloseTo(1750905, 0);

    // Deducciones: 4% salud, 4% pensión sobre el IBC
    const deduccionesEsperadas = 1750905 * 0.08;
    expect(result.deducciones.totalDeducciones).toBeCloseTo(deduccionesEsperadas, 2);

    // Neto a pagar
    const netoEsperado = (1750905 + 249095) - deduccionesEsperadas;
    expect(result.netPay).toBeCloseTo(netoEsperado, 2);

    // Aportes empleador (exonerado de salud, sena, icbf por ganar menos de 10 smmlv y aplicar exoneración)
    expect(result.employer.aportes.salud).toBe(0);
    expect(result.employer.aportes.sena).toBe(0);
    expect(result.employer.aportes.icbf).toBe(0);
    expect(result.employer.aportes.pension).toBeCloseTo(1750905 * 0.12, 2);
    expect(result.employer.aportes.cajaCompensacion).toBeCloseTo(1750905 * 0.04, 2);
  });

  it('calculates recargos correctly based on configured factors', () => {
    const baseSalary = 2200000;
    const employee: EmployeeData = {
      baseSalary,
      isIntegralSalary: false,
      arlRiskClass: "II",
      hireDate: '2025-01-01'
    };

    const novedades: PayrollNovedades = {
      daysWorked: 30,
      extraHoursDiurna: 2, // 2 extra diurnas
      extraHoursNocturna: 0,
      recargoNocturnoHours: 5, // 5 horas con recargo nocturno
      dominicalFestivoDiurnoHours: 0,
      dominicalFestivoNocturnoHours: 0,
      extraDiurnaDominicalFestivoHours: 0,
      extraNocturnaDominicalFestivoHours: 0,
      otherIncomes: 0,
      otherDeductions: 0
    };

    const result = calculatePayroll(employee, novedades, mockConfig);

    const VHO = baseSalary / 220; // 10000
    expect(result.VHO).toBe(VHO);


    // Extra diurna (25% recargo + 100% hora = 1.25) -> 10000 * 2 * 1.25 = 25000
    expect(result.devengado.recargos.extraDiurna).toBeCloseTo(25000, 0);

    // Recargo nocturno (35%) -> 10000 * 5 * 0.35 = 17500
    expect(result.devengado.recargos.recargoNocturno).toBeCloseTo(17500, 0);

    expect(result.devengado.totalRecargos).toBeCloseTo(42500, 0);
    
    // Auxilio de transporte: gana más de 2 SMMLV (2,200,000 > 1,750,905*2 => FALSE, 2.2M is < 3.5M. So gets auxilio)
    expect(result.devengado.auxilioTransporte).toBeCloseTo(249095, 0);

    // IBC must include base salary and recargos
    expect(result.ibc).toBeCloseTo(2200000 + 42500, 0);
  });
});
