// Pure computation module for the Reality Check salary life simulator.
// All figures are clearly-labeled estimates for planning purposes only.

// --- Salary growth model -------------------------------------------------
// Median salary is the anchor at 0 years of experience; it compounds at
// ANNUAL_SALARY_GROWTH_RATE per year until it reaches MAX_SALARY_MULTIPLIER
// times the median.
export const ANNUAL_SALARY_GROWTH_RATE = 0.022;
export const MAX_SALARY_MULTIPLIER = 1.6;
export const MAX_EXPERIENCE_YEARS = 30;

// --- Federal income tax estimate (single filer) ---------------------------
// Tax year 2026 brackets and standard deduction (IRS Rev. Proc. 2025-32).
export const TAX_YEAR = 2026;
export const STANDARD_DEDUCTION_SINGLE = 16100;
export interface TaxBracket {
  readonly rate: number;
  /** Upper bound of taxable income for this bracket (inclusive). */
  readonly upTo: number;
}
export const FEDERAL_BRACKETS_2026_SINGLE: readonly TaxBracket[] = [
  { rate: 0.1, upTo: 12400 },
  { rate: 0.12, upTo: 50400 },
  { rate: 0.22, upTo: 105700 },
  { rate: 0.24, upTo: 201775 },
  { rate: 0.32, upTo: 256225 },
  { rate: 0.35, upTo: 640600 },
  { rate: 0.37, upTo: Infinity },
];

// --- FICA ------------------------------------------------------------------
// Employee-side Social Security (6.2%) up to the annual wage base, plus
// Medicare (1.45%) on all wages.
export const SOCIAL_SECURITY_RATE = 0.062;
export const MEDICARE_RATE = 0.0145;
export const SOCIAL_SECURITY_WAGE_BASE_2026 = 184500;

// --- Lifestyle presets -----------------------------------------------------
// Approximate monthly essential budgets for a single adult (2026 US dollars),
// roughly based on BLS Consumer Expenditure Survey averages, HUD fair-market
// rents and USDA food plan costs. These are baselines, not guarantees.
export type LifestylePreset = 'frugal' | 'moderate' | 'comfortable';

export interface LifestyleBudget {
  housing: number;
  food: number;
  transport: number;
  healthcare: number;
  misc: number;
}

export const LIFESTYLE_BASELINES: Record<LifestylePreset, LifestyleBudget> = {
  frugal: { housing: 950, food: 320, transport: 300, healthcare: 180, misc: 150 },
  moderate: { housing: 1450, food: 480, transport: 450, healthcare: 260, misc: 260 },
  comfortable: { housing: 2100, food: 650, transport: 650, healthcare: 350, misc: 490 },
};

export const LIFESTYLE_ORDER: readonly LifestylePreset[] = ['frugal', 'moderate', 'comfortable'];

export const LIFESTYLE_LABELS: Record<LifestylePreset, string> = {
  frugal: 'Frugal',
  moderate: 'Moderate',
  comfortable: 'Comfortable',
};

/** Leftover below this share of take-home counts as "tight" rather than comfortable. */
export const COMFORTABLE_SAVINGS_RATE_THRESHOLD = 0.1;

export interface BudgetResult {
  categories: LifestyleBudget & { savings: number };
  essentialsTotal: number;
  totalSpending: number;
  savingsRate: number;
}

/**
 * Annual salary after `years` of experience: compounding growth from the
 * median, capped at MAX_SALARY_MULTIPLIER x median.
 */
export function salaryAtExperience(medianAnnual: number, years: number): number {
  if (!Number.isFinite(medianAnnual)) return 0;
  const cappedMultiplier = Math.min(
    Math.pow(1 + ANNUAL_SALARY_GROWTH_RATE, Math.max(0, years)),
    MAX_SALARY_MULTIPLIER
  );
  return medianAnnual * cappedMultiplier;
}

/** Estimated federal income tax for a single filer taking the standard deduction. */
export function federalTaxEstimate(gross: number): number {
  if (!Number.isFinite(gross) || gross <= 0) return 0;
  const taxable = Math.max(0, gross - STANDARD_DEDUCTION_SINGLE);
  let tax = 0;
  let lower = 0;
  for (const bracket of FEDERAL_BRACKETS_2026_SINGLE) {
    if (taxable <= lower) break;
    const slice = Math.min(taxable, bracket.upTo) - lower;
    tax += slice * bracket.rate;
    lower = bracket.upTo;
  }
  return tax;
}

/** Estimated employee-side FICA: 7.65% up to the wage base, 1.45% (Medicare) above. */
export function ficaEstimate(gross: number): number {
  if (!Number.isFinite(gross) || gross <= 0) return 0;
  const ssWages = Math.min(gross, SOCIAL_SECURITY_WAGE_BASE_2026);
  return ssWages * SOCIAL_SECURITY_RATE + gross * MEDICARE_RATE;
}

export interface TakeHomeResult {
  gross: number;
  federal: number;
  fica: number;
  net: number;
  monthlyNet: number;
}

export function takeHome(gross: number): TakeHomeResult {
  const federal = federalTaxEstimate(gross);
  const fica = ficaEstimate(gross);
  const net = gross - federal - fica;
  return { gross, federal, fica, net, monthlyNet: net / 12 };
}

/**
 * Monthly budget for a lifestyle preset scaled to actual take-home pay.
 * Essentials stay at baseline while income covers them; when income falls
 * short, essentials are scaled down proportionally and savings floors at 0.
 */
export function budgetFor(lifestyle: LifestylePreset, monthlyNet: number): BudgetResult {
  const safeNet = Number.isFinite(monthlyNet) && monthlyNet > 0 ? monthlyNet : 0;
  const baseline = LIFESTYLE_BASELINES[lifestyle];
  const essentialsTotal =
    baseline.housing + baseline.food + baseline.transport + baseline.healthcare + baseline.misc;
  const scale = safeNet >= essentialsTotal ? 1 : safeNet / essentialsTotal;

  const categories = {
    housing: baseline.housing * scale,
    food: baseline.food * scale,
    transport: baseline.transport * scale,
    healthcare: baseline.healthcare * scale,
    misc: baseline.misc * scale,
    savings: Math.max(0, safeNet - essentialsTotal),
  };

  const totalSpending = categories.housing + categories.food + categories.transport +
    categories.healthcare + categories.misc + categories.savings;

  return {
    categories,
    essentialsTotal,
    totalSpending,
    savingsRate: safeNet > 0 ? categories.savings / safeNet : 0,
  };
}

export type VerdictStatus = 'shortfall' | 'tight' | 'comfortable';

export interface VerdictResult {
  status: VerdictStatus;
  headline: string;
  detail: string;
}

/** Plain-language verdict on whether this take-home supports the chosen lifestyle. */
export function verdict(monthlyNet: number, budget: BudgetResult): VerdictResult {
  const leftover = Math.round(monthlyNet - budget.essentialsTotal);
  if (leftover < 0 || monthlyNet <= 0) {
    return {
      status: 'shortfall',
      headline: `Shortfall — $${Math.abs(leftover).toLocaleString('en-US')}/mo short`,
      detail: 'Take-home does not cover the essentials for this lifestyle.',
    };
  }
  if (budget.savingsRate < COMFORTABLE_SAVINGS_RATE_THRESHOLD) {
    return {
      status: 'tight',
      headline: `Tight — only $${leftover.toLocaleString('en-US')}/mo left over`,
      detail: 'Essentials consume most of your paycheck. Little room to save.',
    };
  }
  return {
    status: 'comfortable',
    headline: `Comfortable — $${leftover.toLocaleString('en-US')}/mo left over`,
    detail: `You could save about $${Math.round(budget.categories.savings).toLocaleString('en-US')}/mo (${Math.round(budget.savingsRate * 100)}%).`,
  };
}

export interface BreakEvenInput {
  medianAnnual: number;
  educationCost: number;
  yearsExperience: number;
}

export interface BreakEvenResult {
  cumulativeEarnings: number;
  educationCost: number;
  /** cumulativeEarnings / educationCost, floored at educationCost === 0. */
  progressRatio: number | null;
  /** First year in which cumulative gross earnings cover education cost. */
  breakEvenYear: number | null;
}

/**
 * Cumulative gross earnings over the first `yearsExperience` working years
 * (year 1 uses the 0-experience salary) versus the cost of education.
 */
export function breakEvenProgress(input: BreakEvenInput): BreakEvenResult {
  const { medianAnnual, educationCost, yearsExperience } = input;
  const cost = Number.isFinite(educationCost) && educationCost > 0 ? educationCost : 0;
  let cumulative = 0;
  let breakEvenYear: number | null = null;
  for (let year = 1; year <= Math.max(0, Math.floor(yearsExperience)); year++) {
    cumulative += salaryAtExperience(medianAnnual, year - 1);
    if (breakEvenYear === null && cost > 0 && cumulative >= cost) {
      breakEvenYear = year;
    }
  }
  return {
    cumulativeEarnings: cumulative,
    educationCost: cost,
    progressRatio: cost === 0 ? null : cumulative / cost,
    breakEvenYear,
  };
}
