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

export function calculateFinalLiquidation(
  employee: EmployeeData,
  terminationDate: string,
  reason: string,
  daysWorkedYear: number, // Días trabajados en el año actual (para cesantías e intereses)
  daysWorkedSemester: number, // Días trabajados en el semestre actual (para prima)
  daysForVacations: number, // Días laborados a liquidar para vacaciones
  pendingSalaryDays: number, // Días pendientes de pago en el último mes
  config: LegalConfig
) {
  const { configData } = config;
  const isIntegral = employee.isIntegralSalary;
  
  // 1. Salario Pendiente
  const pendingBasicSalary = (employee.baseSalary / 30) * pendingSalaryDays;
  let pendingTransport = 0;
  if (!isIntegral && employee.baseSalary <= configData.smmlv * configData.topeAuxilioTransporteEnSMMLV) {
    pendingTransport = (configData.auxilioTransporte / 30) * pendingSalaryDays;
  }
  
  const totalPendingDevengado = pendingBasicSalary + pendingTransport;
  
  // Deducciones sobre salario pendiente
  let saludDeduction = pendingBasicSalary * configData.aportes.saludEmpleado;
  let pensionDeduction = pendingBasicSalary * configData.aportes.pensionEmpleado;
  if (isIntegral) {
    saludDeduction = (pendingBasicSalary * 0.7) * configData.aportes.saludEmpleado;
    pensionDeduction = (pendingBasicSalary * 0.7) * configData.aportes.pensionEmpleado;
  }
  
  const baseProvisiones = employee.baseSalary + (pendingTransport > 0 ? configData.auxilioTransporte : 0);

  // 2. Prestaciones Sociales
  // Cesantías
  const totalSeverance = isIntegral ? 0 : (baseProvisiones * daysWorkedYear) / 360;
  // Intereses a las Cesantías
  const totalInterests = isIntegral ? 0 : (totalSeverance * daysWorkedYear * configData.provisiones.interesesCesantias * 12) / 360; // 0.12 = 12% anual
  // Prima de Servicios
  const totalPremium = isIntegral ? 0 : (baseProvisiones * daysWorkedSemester) / 360;

  // Vacaciones (no incluye auxilio de transporte)
  const pendingVacationDays = daysForVacations; // Ahora recibe directamente los días a pagar
  const totalVacations = (employee.baseSalary / 30) * pendingVacationDays;
  
  // 3. Indemnización (Estimación muy básica)
  // Nota: Esto depende del contrato y si es sin justa causa
  let totalIndemnity = 0;
  if (reason === 'despido_sin_justa_causa') {
    // Estimación para indefinido si gana menos de 10 SMMLV: 30 días primer año, 20 por siguientes
    // Para simplificar la demo, pondremos 30 días de salario como ejemplo genérico
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
    indemnity: totalIndemnity,
    netPay
  };
}
