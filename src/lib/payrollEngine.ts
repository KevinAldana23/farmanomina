// src/lib/payrollEngine.ts

export interface LegalConfig {
  id?: string;
  validFrom: string;
  validTo?: string | null;
  configData: {
    smmlv: number;
    auxilioTransporte: number;
    topeAuxilioTransporteEnSMMLV: number;
    jornada: {
      horasSemanales: number;
      divisorHoraOrdinaria: number;
      horaInicioNocturno: string; // "19:00"
      horaFinNocturno: string;    // "06:00"
    };
    aportes: {
      saludEmpleado: number;
      pensionEmpleado: number;
      saludEmpleador: number;
      pensionEmpleador: number;
      cajaCompensacion: number;
      sena: number;
      icbf: number;
      arlPorClase: Record<string, number>;
    };
    provisiones: {
      cesantias: number;
      interesesCesantias: number;
      prima: number;
      vacaciones: number;
    };
    fondoSolidaridad: {
      topeEnSMMLV: number;
      porcentajePorRango: { min: number; max: number; pct: number }[];
    };
    recargosYExtras: {
      recargoNocturno: number;
      horaExtraDiurna: number;
      horaExtraNocturna: number;
      dominicalFestivoDiurno: number;
      dominicalFestivoNocturno: number;
      extraDiurnaDominicalFestivo: number;
      extraNocturnaDominicalFestivo: number;
    };
    topesIBC: { minEnSMMLV: number; maxEnSMMLV: number };
    exoneracionParafiscales: { aplicaPorDefecto: boolean; topeEnSMMLV: number };
  };
}

export interface EmployeeData {
  baseSalary: number;
  isIntegralSalary: boolean;
  arlRiskClass: string;
  hireDate: string;
  exonerated?: boolean; // If undefined, check against config
}

export interface PayrollNovedades {
  daysWorked: number;
  extraHoursDiurna: number;
  extraHoursNocturna: number;
  recargoNocturnoHours: number;
  dominicalFestivoDiurnoHours: number;
  dominicalFestivoNocturnoHours: number;
  extraDiurnaDominicalFestivoHours: number;
  extraNocturnaDominicalFestivoHours: number;
  otherIncomes: number;
  otherDeductions: number;
}

export function calculateVHO(baseSalary: number, divisor: number): number {
  return baseSalary / divisor;
}

export function calculatePayroll(
  employee: EmployeeData,
  novedades: PayrollNovedades,
  config: LegalConfig
) {
  const { configData } = config;
  const VHO = calculateVHO(employee.baseSalary, configData.jornada.divisorHoraOrdinaria);
  const isIntegral = employee.isIntegralSalary;

  // 1. Devengado
  const basicSalaryPeriod = (employee.baseSalary / 30) * novedades.daysWorked;
  
  const recargos = {
    // Para horas extra, se suma 1 al factor porque la hora no está pagada en el salario básico
    extraDiurna: VHO * novedades.extraHoursDiurna * (1 + configData.recargosYExtras.horaExtraDiurna),
    extraNocturna: VHO * novedades.extraHoursNocturna * (1 + configData.recargosYExtras.horaExtraNocturna),
    // Para recargos (ordinarios o dominicales dentro de la jornada), solo se paga el recargo
    recargoNocturno: VHO * novedades.recargoNocturnoHours * configData.recargosYExtras.recargoNocturno,
    dominicalFestivoDiurno: VHO * novedades.dominicalFestivoDiurnoHours * configData.recargosYExtras.dominicalFestivoDiurno,
    dominicalFestivoNocturno: VHO * novedades.dominicalFestivoNocturnoHours * configData.recargosYExtras.dominicalFestivoNocturno,
    // Horas extra dominicales/festivas
    extraDiurnaDominicalFestivo: VHO * novedades.extraDiurnaDominicalFestivoHours * (1 + configData.recargosYExtras.extraDiurnaDominicalFestivo),
    extraNocturnaDominicalFestivo: VHO * novedades.extraNocturnaDominicalFestivoHours * (1 + configData.recargosYExtras.extraNocturnaDominicalFestivo),
  };
  
  const totalRecargos = Object.values(recargos).reduce((a, b) => a + b, 0);

  let auxilioTransporte = 0;
  // Solo se paga auxilio de transporte a quienes devengan <= al tope
  if (!isIntegral && employee.baseSalary <= configData.smmlv * configData.topeAuxilioTransporteEnSMMLV) {
    auxilioTransporte = (configData.auxilioTransporte / 30) * novedades.daysWorked;
  }

  const totalDevengado = basicSalaryPeriod + totalRecargos + novedades.otherIncomes + auxilioTransporte;

  // 2. IBC (Ingreso Base de Cotización)
  // Base is basic + recargos + other incomes (excluding auxilio de transporte)
  let IBC = basicSalaryPeriod + totalRecargos + novedades.otherIncomes;
  if (isIntegral) {
    IBC = IBC * 0.7; // El 70% del salario integral
  }

  // Topes IBC
  const minIBC = (configData.smmlv / 30) * novedades.daysWorked;
  const maxIBC = (configData.smmlv * configData.topesIBC.maxEnSMMLV / 30) * novedades.daysWorked;
  
  if (IBC < minIBC) IBC = minIBC;
  if (IBC > maxIBC) IBC = maxIBC;

  // 3. Deducciones Empleado
  const saludDeduction = IBC * configData.aportes.saludEmpleado;
  const pensionDeduction = IBC * configData.aportes.pensionEmpleado;
  
  // Fondo de Solidaridad Pensional (FSP)
  let fspDeduction = 0;
  // FSP se evalúa según si el salario mensual equivalente supera los 4 SMMLV
  const equivalentMonthlyWage = (IBC / novedades.daysWorked) * 30;
  if (equivalentMonthlyWage >= configData.smmlv * configData.fondoSolidaridad.topeEnSMMLV) {
    let fspPct = 0;
    for (const rango of configData.fondoSolidaridad.porcentajePorRango) {
      if (equivalentMonthlyWage >= rango.min * configData.smmlv && (rango.max === Infinity || equivalentMonthlyWage < rango.max * configData.smmlv)) {
        fspPct = rango.pct;
        break;
      }
    }
    fspDeduction = IBC * fspPct;
  }

  const totalDeducciones = saludDeduction + pensionDeduction + fspDeduction + novedades.otherDeductions;
  
  const netPay = totalDevengado - totalDeducciones;

  // 4. Aportes Empleador (Seguridad Social y Parafiscales)
  let aplicaExoneracion = employee.exonerated !== undefined ? employee.exonerated : configData.exoneracionParafiscales.aplicaPorDefecto;
  if (equivalentMonthlyWage >= configData.smmlv * configData.exoneracionParafiscales.topeEnSMMLV) {
    aplicaExoneracion = false;
  }

  const aportesPatronales = {
    salud: aplicaExoneracion ? 0 : IBC * configData.aportes.saludEmpleador,
    pension: IBC * configData.aportes.pensionEmpleador,
    arl: IBC * (configData.aportes.arlPorClase[employee.arlRiskClass] || 0),
    cajaCompensacion: IBC * configData.aportes.cajaCompensacion,
    sena: aplicaExoneracion ? 0 : IBC * configData.aportes.sena,
    icbf: aplicaExoneracion ? 0 : IBC * configData.aportes.icbf,
  };

  const totalAportesPatronales = Object.values(aportesPatronales).reduce((a, b) => a + b, 0);

  // 5. Provisiones
  // Base para provisiones
  let baseProvisiones = totalDevengado; // Incluye auxilio de transporte para prima y cesantias
  const baseVacaciones = basicSalaryPeriod + totalRecargos; // No incluye auxilio, según regla

  
  if (isIntegral) {
    baseProvisiones = 0; // No se liquidan prima ni cesantías en salario integral
  }

  const provisiones = {
    cesantias: isIntegral ? 0 : baseProvisiones * configData.provisiones.cesantias,
    interesesCesantias: isIntegral ? 0 : (baseProvisiones * configData.provisiones.cesantias) * configData.provisiones.interesesCesantias * 12, // 1% mensual = 12% anual sobre las cesantias
    prima: isIntegral ? 0 : baseProvisiones * configData.provisiones.prima,
    vacaciones: baseVacaciones * configData.provisiones.vacaciones,
  };
  
  const totalProvisiones = Object.values(provisiones).reduce((a, b) => a + b, 0);

  return {
    VHO,
    devengado: {
      basicSalaryPeriod,
      auxilioTransporte,
      recargos,
      totalRecargos,
      otherIncomes: novedades.otherIncomes,
      totalDevengado
    },
    ibc: IBC,
    deducciones: {
      salud: saludDeduction,
      pension: pensionDeduction,
      fsp: fspDeduction,
      otherDeductions: novedades.otherDeductions,
      totalDeducciones
    },
    netPay,
    employer: {
      aportes: aportesPatronales,
      totalAportes: totalAportesPatronales,
      provisiones,
      totalProvisiones,
      costoTotal: totalDevengado + totalAportesPatronales + totalProvisiones
    }
  };
}

export interface FinalLiquidationCustomBases {
  /** Base mensual promedio para Cesantías e Intereses (Art. 253 CST: básico + extras + recargos + comisiones + aux. transporte) */
  severanceBase?: number;
  /** Base mensual promedio para Prima de Servicios (Art. 306 CST: básico + extras + recargos + comisiones + aux. transporte del semestre) */
  premiumBase?: number;
  /** Base mensual para Vacaciones (Art. 192 CST: básico + promedio recargo nocturno y comisiones, SIN auxilio y SIN horas extras) */
  vacationBase?: number;
}

/**
 * Calcula la liquidación definitiva laboral conforme al Código Sustantivo del Trabajo (CST).
 * - Art. 253 CST: Base de Cesantías e Intereses (promedio último año si hubo salario variable/extras + auxilio).
 * - Art. 306 CST: Base de Prima de Servicios (promedio semestre en curso si hubo salario variable/extras + auxilio).
 * - Art. 192 CST: Base de Vacaciones (salario ordinario + recargo nocturno promediado, excluyendo extras y auxilio).
 */
export function calculateFinalLiquidation(
  employee: EmployeeData,
  terminationDate: string,
  reason: string,
  daysWorkedYear: number, // Días trabajados en el año actual (para cesantías e intereses - Ley 50/1990)
  daysWorkedSemester: number, // Días trabajados en el semestre actual (para prima)
  daysForVacations: number, // Días adeudados a liquidar para vacaciones (acumulados o proporcionales)
  pendingSalaryDays: number, // Días pendientes de pago en el último mes
  config: LegalConfig,
  customBases?: FinalLiquidationCustomBases
) {
  const { configData } = config;
  const isIntegral = employee.isIntegralSalary;
  
  // 1. Salario Pendiente
  const pendingBasicSalary = (employee.baseSalary / 30) * pendingSalaryDays;
  const appliesTransport = !isIntegral && employee.baseSalary <= configData.smmlv * configData.topeAuxilioTransporteEnSMMLV;
  const auxilioTransporte = appliesTransport ? configData.auxilioTransporte : 0;
  
  let pendingTransport = 0;
  if (appliesTransport) {
    pendingTransport = (auxilioTransporte / 30) * pendingSalaryDays;
  }
  
  const totalPendingDevengado = pendingBasicSalary + pendingTransport;
  
  // Deducciones sobre salario pendiente
  let saludDeduction = pendingBasicSalary * configData.aportes.saludEmpleado;
  let pensionDeduction = pendingBasicSalary * configData.aportes.pensionEmpleado;
  if (isIntegral) {
    saludDeduction = (pendingBasicSalary * 0.7) * configData.aportes.saludEmpleado;
    pensionDeduction = (pendingBasicSalary * 0.7) * configData.aportes.pensionEmpleado;
  }
  
  // 2. Determinación de Bases Salariales según el CST
  // Base Cesantías e Intereses: Promedio anual o básico + Auxilio de transporte (Art. 253 CST)
  const defaultSeveranceBase = employee.baseSalary + auxilioTransporte;
  const severanceBase = (customBases?.severanceBase !== undefined && customBases.severanceBase > 0)
    ? customBases.severanceBase
    : defaultSeveranceBase;

  // Base Prima de Servicios: Promedio semestral o básico + Auxilio de transporte (Art. 306 CST)
  const defaultPremiumBase = employee.baseSalary + auxilioTransporte;
  const premiumBase = (customBases?.premiumBase !== undefined && customBases.premiumBase > 0)
    ? customBases.premiumBase
    : defaultPremiumBase;

  // Base Vacaciones: Salario ordinario + Recargo nocturno promediado (Art. 192 CST: SIN auxilio de transporte y SIN horas extras)
  const defaultVacationBase = employee.baseSalary;
  const vacationBase = (customBases?.vacationBase !== undefined && customBases.vacationBase > 0)
    ? customBases.vacationBase
    : defaultVacationBase;

  // 3. Prestaciones Sociales
  // Cesantías (Art. 249 y 253 CST)
  const totalSeverance = isIntegral ? 0 : (severanceBase * daysWorkedYear) / 360;
  
  // Intereses a las Cesantías (Ley 52 de 1975: 12% anual proporcional a los días laborados)
  const totalInterests = isIntegral ? 0 : (totalSeverance * daysWorkedYear * configData.provisiones.interesesCesantias * 12) / 360;
  
  // Prima de Servicios (Art. 306 CST)
  const totalPremium = isIntegral ? 0 : (premiumBase * daysWorkedSemester) / 360;

  // Vacaciones (Art. 186 y 192 CST: base mensual / 30 * días de vacaciones adeudados)
  const pendingVacationDays = daysForVacations;
  const totalVacations = (vacationBase / 30) * pendingVacationDays;
  
  // 4. Indemnización (Estimación según Art. 64 CST)
  let totalIndemnity = 0;
  if (reason === 'despido_sin_justa_causa') {
    // Estimación para contrato indefinido si gana menos de 10 SMMLV: 30 días primer año
    totalIndemnity = employee.baseSalary; 
  }

  const netPay = totalPendingDevengado - (saludDeduction + pensionDeduction) + totalSeverance + totalInterests + totalPremium + totalVacations + totalIndemnity;

  return {
    pendingSalary: {
      basic: pendingBasicSalary,
      transport: pendingTransport,
      salud: saludDeduction,
      pension: pensionDeduction,
      netPending: totalPendingDevengado - (saludDeduction + pensionDeduction)
    },
    benefits: {
      severance: totalSeverance,
      interests: totalInterests,
      premium: totalPremium,
      vacations: totalVacations,
      pendingVacationDays: pendingVacationDays
    },
    basesUsed: {
      severanceBase,
      premiumBase,
      vacationBase,
      appliesTransport
    },
    indemnity: totalIndemnity,
    netPay
  };
}

