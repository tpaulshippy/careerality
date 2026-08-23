import { CareerROI } from '../types';

export interface PlanStep {
  id: string;
  title: string;
  description: string;
  url?: string;
  copyText?: string;
  why: string;
}

export interface ActionPlan {
  steps: PlanStep[];
}

export const ACTION_PLAN_STEP_COUNT = 6;

const EXCERPT_LENGTH = 220;

export const slugify = (value: string): string => encodeURIComponent(value.trim());

/**
 * Extracts a searchable state/place name from an area_name.
 * "New York-Newark-Jersey City, NY-NJ" -> "New York"
 * "New Jersey" -> "New Jersey"
 * National rows (area_code "99", whatever their label) -> null.
 */
export const extractStateName = (
  areaName: string | undefined,
  areaCode?: string | null,
): string | null => {
  if (!areaName || areaCode === '99' || areaName === 'U.S.') return null;
  const primary = areaName.split(',')[0].trim();
  if (!primary) return null;
  return primary.split('-')[0].trim() || null;
};

export const excerptText = (text: string, maxLength: number = EXCERPT_LENGTH): string => {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  const slice = trimmed.slice(0, maxLength);
  const lastSpace = slice.lastIndexOf(' ');
  return `${(lastSpace > 0 ? slice.slice(0, lastSpace) : slice).trimEnd()}…`;
};

export const buildInterviewMessage = (occupationName: string): string =>
  [
    'Hi [Name],',
    '',
    `I'm exploring a career as a ${occupationName} and would love to learn from someone doing the job. Would you be open to a 15-minute informational interview in the next few weeks?`,
    '',
    "I'm especially curious what a typical week looks like and what you wish you had known when you were starting out.",
    '',
    'Thank you!',
    '[Your name]',
  ].join('\n');

export const buildPlan = (career: CareerROI): ActionPlan => {
  const name = career.occupation_name;
  const encodedName = slugify(name);
  // O*NET summary links work with the base code; drop a trailing ".00" detail suffix.
  const onetCode = career.occupation_code.replace(/\.00$/, '');

  const dayInLifeExcerpt = career.day_in_life_full
    ? excerptText(career.day_in_life_full)
    : null;

  const skill = career.skills && career.skills.length > 0 ? career.skills[0] : null;
  const courseQuery = skill ?? name;

  const stateName = extractStateName(career.area_name, career.area_code);
  const openingsNote =
    career.avg_annual_openings != null
      ? ` Around ${career.avg_annual_openings.toLocaleString('en-US')} openings open up each year in this area.`
      : '';
  const growthNote =
    career.projected_growth_percent != null
      ? ` Projected growth: ${career.projected_growth_percent > 0 ? '+' : ''}${career.projected_growth_percent}%.`
      : '';

  return {
    steps: [
      {
        id: 'see-the-work',
        title: 'See the work',
        description: dayInLifeExcerpt
          ? `Skim the official O*NET profile, then read this snapshot of a typical day: "${dayInLifeExcerpt}"`
          : 'Read the official O*NET profile to see the day-to-day tasks, tools, and skills this career really involves.',
        url: `https://www.onetonline.org/link/summary/${slugify(onetCode)}`,
        why: 'Ground the decision in what the job actually involves before investing time or money.',
      },
      {
        id: 'watch-workers',
        title: 'Watch real workers do it',
        description: `A few minutes of "day in the life" videos shows the pace, environment, and people of this job better than any description.`,
        url: `https://www.youtube.com/results?search_query=${encodedName}+day+in+the+life`,
        why: 'Video reveals culture and working conditions that written profiles leave out.',
      },
      {
        id: 'find-openings',
        title: 'Find live job postings',
        description: `Browse real current postings${stateName ? ` in ${stateName}` : ''} to see who is hiring and what they ask for.${openingsNote}`,
        url: stateName
          ? `https://www.careeronestop.org/Toolkit/Careers/Occupations/occupation-profile.aspx?keyword=${encodedName}&location=${slugify(stateName)}`
          : `https://www.careeronestop.org/Toolkit/Careers/Occupations/occupation-profile.aspx?keyword=${encodedName}`,
        why: 'Live postings show the real requirements employers have today, not averages.',
      },
      {
        id: 'check-outlook',
        title: 'Check the outlook',
        description: `Look up the official Bureau of Labor Statistics outlook for hiring trends and wages.${growthNote}`,
        url: `https://www.bls.gov/ooh/occupation-finder.htm?keyword=${encodedName}`,
        why: 'A strong paycheck matters most when demand will still be there in ten years.',
      },
      {
        id: 'learn-skill',
        title: 'Deep-dive a core skill',
        description: skill
          ? `Try a free introductory course on "${skill}" — a core skill for ${name} — to taste the work before committing.`
          : `Try a free introductory course related to ${name} to taste the work before committing.`,
        url: `https://www.coursera.org/search?query=${slugify(courseQuery)}`,
        why: 'Testing one skill cheaply beats discovering a mismatch after enrolling.',
      },
      {
        id: 'talk-to-pro',
        title: 'Reach out to a professional',
        description: 'Send the ready-made message below to someone in the field — a short chat gives perspective no research can.',
        copyText: buildInterviewMessage(name),
        why: 'One honest conversation surfaces realities that no website covers.',
      },
    ],
  };
};
