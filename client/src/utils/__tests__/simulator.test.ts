import {
  ANNUAL_SALARY_GROWTH_RATE,
  COMFORTABLE_SAVINGS_RATE_THRESHOLD,
  FEDERAL_BRACKETS_2026_SINGLE,
  LIFESTYLE_BASELINES,
  MAX_SALARY_MULTIPLIER,
  MEDICARE_RATE,
  SOCIAL_SECURITY_RATE,
  SOCIAL_SECURITY_WAGE_BASE_2026,
  STANDARD_DEDUCTION_SINGLE,
  salaryAtExperience,
  federalTaxEstimate,
  ficaEstimate,
  takeHome,
  budgetFor,
  verdict,
  breakEvenProgress,
} from '../simulator';

const essentialsOf = (lifestyle: keyof typeof LIFESTYLE_BASELINES) => {
  const b = LIFESTYLE_BASELINES[lifestyle];
  return b.housing + b.food + b.transport + b.healthcare + b.misc;
};

describe('salaryAtExperience', () => {
  it('returns the median at zero years', () => {
    expect(salaryAtExperience(100000, 0)).toBeCloseTo(100000, 6);
  });

  it('compounds at the documented growth rate', () => {
    expect(salaryAtExperience(100000, 1)).toBeCloseTo(100000 * (1 + ANNUAL_SALARY_GROWTH_RATE), 6);
    expect(salaryAtExperience(100000, 5)).toBeCloseTo(
      100000 * Math.pow(1 + ANNUAL_SALARY_GROWTH_RATE, 5),
      6
    );
  });

  it('caps growth at MAX_SALARY_MULTIPLIER x median', () => {
    const capped = 100000 * MAX_SALARY_MULTIPLIER;
    // 30 years of 2.2% growth (~1.918x) exceeds the cap.
    expect(Math.pow(1 + ANNUAL_SALARY_GROWTH_RATE, 30)).toBeGreaterThan(MAX_SALARY_MULTIPLIER);
    expect(salaryAtExperience(100000, 22)).toBeCloseTo(capped, 4);
    expect(salaryAtExperience(100000, 30)).toBeCloseTo(capped, 4);
    expect(salaryAtExperience(100000, 30)).toBeLessThanOrEqual(capped);
  });

  it('treats negative years as zero experience', () => {
    expect(salaryAtExperience(100000, -3)).toBeCloseTo(100000, 6);
  });

  it('handles non-finite medians defensively', () => {
    expect(salaryAtExperience(NaN, 10)).toBe(0);
    expect(salaryAtExperience(Infinity, 10)).toBe(0);
  });
});

describe('federalTaxEstimate', () => {
  it('is zero for non-positive income', () => {
    expect(federalTaxEstimate(0)).toBe(0);
    expect(federalTaxEstimate(-50000)).toBe(0);
    expect(federalTaxEstimate(NaN)).toBe(0);
  });

  it('is zero when gross is within the standard deduction', () => {
    expect(federalTaxEstimate(STANDARD_DEDUCTION_SINGLE)).toBe(0);
    expect(federalTaxEstimate(12000)).toBe(0);
  });

  it('applies the 10% bracket just above the standard deduction', () => {
    const taxable = STANDARD_DEDUCTION_SINGLE + 1000;
    expect(federalTaxEstimate(taxable)).toBeCloseTo(1000 * 0.1, 6);
  });

  it('matches hand-computed tax at the 10%/12% bracket edge', () => {
    const gross = STANDARD_DEDUCTION_SINGLE + 12400; // taxable exactly at first bracket top
    expect(federalTaxEstimate(gross)).toBeCloseTo(12400 * 0.1, 6);
    const oneDollarMore = gross + 1;
    expect(federalTaxEstimate(oneDollarMore)).toBeCloseTo(1240 + 1 * 0.12, 6);
  });

  it('matches hand-computed tax at the 12%/22% bracket edge', () => {
    const gross = STANDARD_DEDUCTION_SINGLE + 50400;
    const expected = 12400 * 0.1 + (50400 - 12400) * 0.12;
    expect(federalTaxEstimate(gross)).toBeCloseTo(expected, 6);
  });

  it('is strictly increasing across every bracket boundary', () => {
    for (const bracket of FEDERAL_BRACKETS_2026_SINGLE) {
      if (!Number.isFinite(bracket.upTo)) continue;
      const atEdge = federalTaxEstimate(STANDARD_DEDUCTION_SINGLE + bracket.upTo);
      const above = federalTaxEstimate(STANDARD_DEDUCTION_SINGLE + bracket.upTo + 1);
      expect(above).toBeGreaterThan(atEdge);
    }
  });

  it('uses the top rate for very high incomes', () => {
    const gross = STANDARD_DEDUCTION_SINGLE + 700000;
    const expected =
      12400 * 0.1 +
      (50400 - 12400) * 0.12 +
      (105700 - 50400) * 0.22 +
      (201775 - 105700) * 0.24 +
      (256225 - 201775) * 0.32 +
      (640600 - 256225) * 0.35 +
      (700000 - 640600) * 0.37;
    expect(federalTaxEstimate(gross)).toBeCloseTo(expected, 4);
  });
});

describe('ficaEstimate', () => {
  it('charges combined 7.65% below the wage base', () => {
    expect(ficaEstimate(50000)).toBeCloseTo(50000 * (SOCIAL_SECURITY_RATE + MEDICARE_RATE), 6);
  });

  it('charges exactly 7.65% at the wage base', () => {
    expect(ficaEstimate(SOCIAL_SECURITY_WAGE_BASE_2026)).toBeCloseTo(
      SOCIAL_SECURITY_WAGE_BASE_2026 * (SOCIAL_SECURITY_RATE + MEDICARE_RATE),
      6
    );
  });

  it('switches to Medicare-only above the wage base', () => {
    const gross = SOCIAL_SECURITY_WAGE_BASE_2026 + 10000;
    const expected =
      SOCIAL_SECURITY_WAGE_BASE_2026 * SOCIAL_SECURITY_RATE + gross * MEDICARE_RATE;
    expect(ficaEstimate(gross)).toBeCloseTo(expected, 6);
  });

  it('is zero for non-positive income', () => {
    expect(ficaEstimate(0)).toBe(0);
    expect(ficaEstimate(-1)).toBe(0);
  });

  it('grows slowly above the wage base (Medicare only)', () => {
    const atBasePlus1 = ficaEstimate(SOCIAL_SECURITY_WAGE_BASE_2026 + 1) -
      ficaEstimate(SOCIAL_SECURITY_WAGE_BASE_2026);
    expect(atBasePlus1).toBeCloseTo(MEDICARE_RATE, 6);
  });
});

describe('takeHome', () => {
  it('nets gross minus federal minus FICA and splits monthly', () => {
    const result = takeHome(93600);
    expect(result.gross).toBe(93600);
    expect(result.federal).toBeCloseTo(federalTaxEstimate(93600), 6);
    expect(result.fica).toBeCloseTo(ficaEstimate(93600), 6);
    expect(result.net).toBeCloseTo(93600 - result.federal - result.fica, 6);
    expect(result.monthlyNet).toBeCloseTo(result.net / 12, 6);
  });

  it('keeps net positive at typical salaries', () => {
    expect(takeHome(40000).net).toBeGreaterThan(0);
    expect(takeHome(200000).net).toBeGreaterThan(0);
  });

  it('returns all zeros at zero gross', () => {
    expect(takeHome(0)).toEqual({ gross: 0, federal: 0, fica: 0, net: 0, monthlyNet: 0 });
  });
});

describe('budgetFor', () => {
  it('keeps essentials at baseline and saves the remainder with high income', () => {
    const budget = budgetFor('moderate', 6000);
    expect(budget.categories.housing).toBe(LIFESTYLE_BASELINES.moderate.housing);
    expect(budget.categories.food).toBe(LIFESTYLE_BASELINES.moderate.food);
    expect(budget.categories.savings).toBeCloseTo(6000 - essentialsOf('moderate'), 6);
    expect(budget.totalSpending).toBeCloseTo(6000, 6);
    expect(budget.savingsRate).toBeCloseTo((6000 - essentialsOf('moderate')) / 6000, 6);
  });

  it('scales essentials down proportionally when net is below baseline', () => {
    const base = essentialsOf('frugal');
    const budget = budgetFor('frugal', base / 2);
    expect(budget.categories.housing).toBeCloseTo(LIFESTYLE_BASELINES.frugal.housing / 2, 6);
    expect(budget.categories.misc).toBeCloseTo(LIFESTYLE_BASELINES.frugal.misc / 2, 6);
    expect(budget.categories.savings).toBe(0);
    expect(budget.totalSpending).toBeCloseTo(base / 2, 6);
  });

  it('floors savings at zero when net slightly trails essentials', () => {
    const base = essentialsOf('moderate');
    const budget = budgetFor('moderate', base - 1);
    expect(budget.categories.savings).toBe(0);
    expect(budget.savingsRate).toBe(0);
  });

  it('handles zero and negative net without producing NaN', () => {
    for (const net of [0, -250]) {
      const budget = budgetFor('comfortable', net);
      expect(budget.categories.housing).toBe(0);
      expect(budget.categories.food).toBe(0);
      expect(budget.categories.transport).toBe(0);
      expect(budget.categories.healthcare).toBe(0);
      expect(budget.categories.misc).toBe(0);
      expect(budget.categories.savings).toBe(0);
      expect(budget.savingsRate).toBe(0);
      expect(budget.totalSpending).toBe(0);
    }
  });

  it('saves more under frugal than comfortable at equal income', () => {
    const frugal = budgetFor('frugal', 4500);
    const comfortable = budgetFor('comfortable', 4500);
    expect(frugal.categories.savings).toBeGreaterThan(comfortable.categories.savings);
  });
});

describe('verdict', () => {
  it('reports a shortfall with a positive shortage amount when essentials exceed net', () => {
    const budget = budgetFor('moderate', 1000);
    const result = verdict(1000, budget);
    expect(result.status).toBe('shortfall');
    expect(result.headline).toMatch(/Shortfall/);
    expect(result.headline).toContain('$');
    expect(result.headline).not.toContain('-$');
  });

  it('reports a shortfall at zero net', () => {
    expect(verdict(0, budgetFor('frugal', 0)).status).toBe('shortfall');
  });

  it('reports tight when leftover is positive but savings rate is under threshold', () => {
    const base = essentialsOf('moderate');
    const netJustAbove = base * (1 + COMFORTABLE_SAVINGS_RATE_THRESHOLD / 2);
    const result = verdict(netJustAbove, budgetFor('moderate', netJustAbove));
    expect(result.status).toBe('tight');
    expect(result.headline).toMatch(/Tight/);
  });

  it('reports comfortable once savings exceed the threshold share of net', () => {
    const base = essentialsOf('moderate');
    const net = base / (1 - COMFORTABLE_SAVINGS_RATE_THRESHOLD * 1.5);
    const result = verdict(net, budgetFor('moderate', net));
    expect(result.status).toBe('comfortable');
    expect(result.headline).toMatch(/Comfortable/);
    expect(result.headline).toContain('/mo left over');
  });

  it('rounds the leftover amount in headlines', () => {
    const net = essentialsOf('frugal') + 740.49;
    const result = verdict(net, budgetFor('frugal', net));
    expect(result.headline).toContain('$740/mo left over');
  });
});

describe('breakEvenProgress', () => {
  it('recovers the career breakeven year from cumulative earnings', () => {
    const result = breakEvenProgress({ medianAnnual: 50000, educationCost: 75000, yearsExperience: 10 });
    // Year 1: 50000, Year 2: 50000*1.022 -> cumulative passes 75000 in year 2.
    expect(result.breakEvenYear).toBe(2);
    expect(result.cumulativeEarnings).toBeGreaterThan(75000);
    expect(result.progressRatio).toBeGreaterThan(1);
  });

  it('sums the growing salary series over the given years', () => {
    const result = breakEvenProgress({ medianAnnual: 60000, educationCost: 0, yearsExperience: 3 });
    const expected =
      salaryAtExperience(60000, 0) +
      salaryAtExperience(60000, 1) +
      salaryAtExperience(60000, 2);
    expect(result.cumulativeEarnings).toBeCloseTo(expected, 4);
  });

  it('respects the salary cap inside cumulative earnings', () => {
    const flat = breakEvenProgress({ medianAnnual: 100000, educationCost: 0, yearsExperience: 30 });
    expect(flat.cumulativeEarnings).toBeLessThanOrEqual(100000 * MAX_SALARY_MULTIPLIER * 30);
  });

  it('returns null breakEvenYear when education cost is not yet covered', () => {
    const result = breakEvenProgress({ medianAnnual: 40000, educationCost: 10000000, yearsExperience: 15 });
    expect(result.breakEvenYear).toBeNull();
    expect(result.progressRatio).toBeLessThan(1);
  });

  it('handles zero education cost as immediate break-even', () => {
    const result = breakEvenProgress({ medianAnnual: 50000, educationCost: 0, yearsExperience: 5 });
    expect(result.educationCost).toBe(0);
    expect(result.breakEvenYear).toBeNull();
    expect(result.progressRatio).toBeNull();
  });

  it('handles zero years of experience', () => {
    const result = breakEvenProgress({ medianAnnual: 50000, educationCost: 30000, yearsExperience: 0 });
    expect(result.cumulativeEarnings).toBe(0);
    expect(result.breakEvenYear).toBeNull();
  });

  it('is monotonic: more experience never lowers cumulative earnings or delays breakeven', () => {
    let prev = breakEvenProgress({ medianAnnual: 55000, educationCost: 80000, yearsExperience: 1 });
    for (let y = 2; y <= 20; y++) {
      const next = breakEvenProgress({ medianAnnual: 55000, educationCost: 80000, yearsExperience: y });
      expect(next.cumulativeEarnings).toBeGreaterThan(prev.cumulativeEarnings);
      if (prev.breakEvenYear !== null) {
        expect(next.breakEvenYear).toBe(prev.breakEvenYear);
      }
      prev = next;
    }
  });
});
