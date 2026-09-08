import fetch from 'node-fetch';

export interface GreenhouseJob {
  id: number;
  title: string;
  location: { name: string };
  absolute_url: string;
  updated_at: string;
  content?: string;
  departments?: { name: string }[];
}

export interface GreenhouseResponse {
  jobs: GreenhouseJob[];
}

export async function fetchGreenhouseJobs(
  companyId: string
): Promise<GreenhouseJob[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${companyId}/jobs?content=true`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`Greenhouse API error for ${companyId}: ${response.status}`);
      return [];
    }

    const data = (await response.json()) as GreenhouseResponse;
    return data.jobs || [];
  } catch (error) {
    console.error(`Error fetching Greenhouse jobs for ${companyId}:`, error);
    return [];
  }
}

export function filterJobsByKeywords(
  jobs: GreenhouseJob[],
  keywords: string[]
): GreenhouseJob[] {
  const keywordPatterns = keywords.map(
    (k) => new RegExp(k.replace(/\s+/g, '\\s*'), 'i')
  );

  return jobs.filter((job) =>
    keywordPatterns.some((pattern) => pattern.test(job.title))
  );
}

export function scoreJob(job: GreenhouseJob, roleKeywords: {
  primary: string[];
  secondary: string[];
  tertiary: string[];
}): number {
  const title = job.title.toLowerCase();

  // Primary roles get highest score
  for (const keyword of roleKeywords.primary) {
    if (title.includes(keyword.toLowerCase())) {
      return 1.0;
    }
  }

  // Secondary roles
  for (const keyword of roleKeywords.secondary) {
    if (title.includes(keyword.toLowerCase())) {
      return 0.7;
    }
  }

  // Tertiary roles
  for (const keyword of roleKeywords.tertiary) {
    if (title.includes(keyword.toLowerCase())) {
      return 0.4;
    }
  }

  return 0;
}
