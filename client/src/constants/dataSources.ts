import { DataSource } from '../types';

export const DATA_SOURCES: DataSource[] = [
  {
    name: 'Bureau of Labor Statistics (BLS)',
    source: 'Occupational Employment and Wage Statistics (OEWS)',
    lag: '2-3 years',
    description: 'Salary data, employment statistics, and job outlook information for occupations',
    lastUpdated: 'May 2024',
  },
  {
    name: 'Bureau of Labor Statistics (BLS)',
    source: 'Consumer Expenditure Survey (CE)',
    lag: '1-2 years',
    description: 'Cost of living and expenditure data used to calculate regional purchasing power',
    lastUpdated: '2023',
  },
  {
    name: 'National Center for Education Statistics (NCES)',
    source: 'IPEDS',
    lag: '1-2 years',
    description: 'Education costs, tuition, and program duration for various degree paths',
    lastUpdated: '2023-24',
  },
  {
    name: "O*NET",
    source: 'Skills, Abilities, Work Activities Database',
    lag: 'Ongoing updates',
    description: 'Occupational skills requirements, job zones, and ability profiles',
    lastUpdated: 'Continuously updated',
  },
];

export const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://careerality.app';
export const API_URL = `${API_BASE}/api/roi`;

export const LOCATION_OPTIONS = [
  { label: 'All Locations', value: 'all' },
  { label: 'Northeast', value: 'northeast' },
  { label: 'Southeast', value: 'southeast' },
  { label: 'Midwest', value: 'midwest' },
  { label: 'Southwest', value: 'southwest' },
  { label: 'West', value: 'west' },
  { label: 'Remote', value: 'remote' },
];

export const SALARY_RANGES = [
  { label: 'Any Salary', min: 0, max: Infinity },
  { label: '$30,000+', min: 30000, max: Infinity },
  { label: '$50,000+', min: 50000, max: Infinity },
  { label: '$75,000+', min: 75000, max: Infinity },
  { label: '$100,000+', min: 100000, max: Infinity },
  { label: '$150,000+', min: 150000, max: Infinity },
];
