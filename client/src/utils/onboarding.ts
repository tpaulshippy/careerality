import { SortOption } from '../types';

export const NATIONAL_STATE_CODE = '99';
export const DEFAULT_EDU_PREF: EduPref = 'any';

export const ONBOARDING_STORAGE_KEYS = {
  onboarded: 'careerality_onboarded',
  eduPref: 'careerality_edu_pref',
} as const;

export type EduPref = 'none' | 'associate' | 'bachelor' | 'graduate' | 'any';

export type SalaryPresetKey = 'any' | '30k' | '50k' | '75k' | '100k' | '150k';

export interface SalaryPreset {
  key: SalaryPresetKey;
  label: string;
  minSalary: number;
}

export const SALARY_PRESETS: SalaryPreset[] = [
  { key: 'any', label: 'Any', minSalary: 0 },
  { key: '30k', label: '$30k+', minSalary: 30000 },
  { key: '50k', label: '$50k+', minSalary: 50000 },
  { key: '75k', label: '$75k+', minSalary: 75000 },
  { key: '100k', label: '$100k+', minSalary: 100000 },
  { key: '150k', label: '$150k+', minSalary: 150000 },
];

export interface EduPrefOption {
  value: EduPref;
  label: string;
}

export const EDU_PREF_OPTIONS: EduPrefOption[] = [
  { value: 'none', label: 'No degree required' },
  { value: 'associate', label: "Associate's" },
  { value: 'bachelor', label: "Bachelor's" },
  { value: 'graduate', label: 'Graduate' },
  { value: 'any', label: 'Any' },
];

export interface PriorityOption {
  value: SortOption;
  label: string;
}

export const PRIORITY_OPTIONS: PriorityOption[] = [
  { value: 'salary', label: 'Maximize pay' },
  { value: 'breakeven', label: 'Fastest break-even' },
  { value: 'demand', label: 'Most demand' },
  { value: 'roi', label: 'Best ROI' },
];

// Zero-based quiz steps.
export const ONBOARDING_STEPS = {
  welcome: 0,
  location: 1,
  salary: 2,
  education: 3,
  priority: 4,
} as const;

export const TOTAL_STEPS = 5;

export interface StateOption {
  area_code: string;
  area_name: string;
}

export interface OnboardingAnswers {
  stateCode: string | null;
  salaryPreset: SalaryPresetKey | null;
  eduPref: EduPref | null;
  priority: SortOption | null;
}

export const EMPTY_ANSWERS: OnboardingAnswers = {
  stateCode: null,
  salaryPreset: null,
  eduPref: null,
  priority: null,
};

export const canAdvance = (step: number, answers: OnboardingAnswers): boolean => {
  switch (step) {
    case ONBOARDING_STEPS.location:
      return answers.stateCode !== null;
    case ONBOARDING_STEPS.salary:
      return answers.salaryPreset !== null;
    case ONBOARDING_STEPS.education:
      return answers.eduPref !== null;
    case ONBOARDING_STEPS.priority:
      return answers.priority !== null;
    default:
      return true;
  }
};

export interface OnboardingPayload {
  filterPatch: { stateCode: string; minSalary: number };
  sortBy: SortOption;
  eduPref: EduPref;
}

export const assemblePayload = (answers: OnboardingAnswers): OnboardingPayload => {
  const preset =
    SALARY_PRESETS.find(p => p.key === answers.salaryPreset) ?? SALARY_PRESETS[0];
  return {
    filterPatch: {
      stateCode: answers.stateCode ?? NATIONAL_STATE_CODE,
      minSalary: preset.minSalary,
    },
    sortBy: answers.priority ?? 'roi',
    eduPref: answers.eduPref ?? DEFAULT_EDU_PREF,
  };
};

// Pins the national option (area_code "99") first with a friendlier label,
// mirroring FilterSheet's ordering of the /api/areas/states response.
export const buildStateOptions = (states: StateOption[]): StateOption[] => {
  const national = states.find(s => s.area_code === NATIONAL_STATE_CODE);
  if (!national) return states;
  return [
    { ...national, area_name: 'National (all states)' },
    ...states.filter(s => s.area_code !== NATIONAL_STATE_CODE),
  ];
};

export const filterStateOptions = (states: StateOption[], query: string): StateOption[] => {
  const q = query.trim().toLowerCase();
  if (!q) return states;
  return states.filter(s => s.area_name.toLowerCase().includes(q));
};
