export interface CareerROI {
  id: number;
  occupation_code: string;
  occupation_name: string;
  area_code: string;
  area_name: string;
  annual_median_salary: string;
  education_cost: string;
  years_to_breakeven: number;
  roi_percentage: string;
  job_zone: number;
  education_level: string;
  skills: string[];
  cost_of_living_index: string;
  adjusted_salary: string;
  industry_code: string;
  industry_name: string;
  demand_rank: number | null;
  avg_annual_openings: number | null;
  projected_growth_percent: number | null;
}

export interface DataSource {
  name: string;
  source: string;
  lag: string;
  description: string;
  lastUpdated: string;
}

export interface InfoRowProps {
  label: string;
  value: string | number;
  valueColor?: string;
  highlight?: boolean;
}

export interface SectionProps {
  title: string;
  children: React.ReactNode;
}

export type SwipeDirection = 'left' | 'right';

export interface Swipe {
  id: string;
  careerId: number;
  direction: SwipeDirection;
  feedback?: string;
  createdAt: Date;
}

export interface FilterState {
  stateCode: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
}

export type SwipeHistory = Swipe[];
