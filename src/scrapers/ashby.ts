import fetch from 'node-fetch';

export interface AshbyJob {
  id: string;
  title: string;
  location: string;
  employmentType: string;
  departmentName?: string;
  teamName?: string;
  jobUrl: string;
  updatedAt?: string;
  descriptionPlain?: string;
}

interface AshbyApiResponse {
  jobs: {
    id: string;
    title: string;
    location: string;
    employmentType: string;
    department: string;
    team: string;
    isListed: boolean;
    publishedAt: string;
    updatedAt: string;
    jobUrl: string;
    descriptionPlain?: string;
  }[];
}

export async function fetchAshbyJobs(boardId: string): Promise<AshbyJob[]> {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${boardId}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`Ashby API error for ${boardId}: ${response.status}`);
      return [];
    }

    const data = (await response.json()) as AshbyApiResponse;
    if (!data.jobs) return [];

    return data.jobs.map((job) => ({
      id: job.id,
      title: job.title,
      location: job.location,
      employmentType: job.employmentType,
      departmentName: job.department,
      teamName: job.team,
      jobUrl: job.jobUrl,
      updatedAt: job.updatedAt,
    }));
  } catch (error) {
    console.error(`Error fetching Ashby jobs for ${boardId}:`, error);
    return [];
  }
}

export function filterAshbyJobsByKeywords(
  jobs: AshbyJob[],
  keywords: string[]
): AshbyJob[] {
  const keywordPatterns = keywords.map(
    (k) => new RegExp(k.replace(/\s+/g, '\\s*'), 'i')
  );

  return jobs.filter((job) =>
    keywordPatterns.some((pattern) => pattern.test(job.title))
  );
}

export function scoreAshbyJob(
  job: AshbyJob,
  roleKeywords: {
    primary: string[];
    secondary: string[];
    tertiary: string[];
  }
): number {
  const title = job.title.toLowerCase();

  for (const keyword of roleKeywords.primary) {
    if (title.includes(keyword.toLowerCase())) {
      return 1.0;
    }
  }

  for (const keyword of roleKeywords.secondary) {
    if (title.includes(keyword.toLowerCase())) {
      return 0.7;
    }
  }

  for (const keyword of roleKeywords.tertiary) {
    if (title.includes(keyword.toLowerCase())) {
      return 0.4;
    }
  }

  return 0;
}
