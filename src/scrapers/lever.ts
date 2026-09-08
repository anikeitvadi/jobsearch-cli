import fetch from 'node-fetch';

export interface LeverJob {
  id: string;
  text: string;
  categories: {
    commitment?: string;
    location?: string;
    team?: string;
    department?: string;
  };
  hostedUrl: string;
  createdAt: number;
  descriptionPlain?: string;
}

export async function fetchLeverJobs(companyId: string): Promise<LeverJob[]> {
  const url = `https://api.lever.co/v0/postings/${companyId}?mode=json`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`Lever API error for ${companyId}: ${response.status}`);
      return [];
    }

    const data = (await response.json()) as LeverJob[];
    return data || [];
  } catch (error) {
    console.error(`Error fetching Lever jobs for ${companyId}:`, error);
    return [];
  }
}

export function filterLeverJobsByKeywords(
  jobs: LeverJob[],
  keywords: string[]
): LeverJob[] {
  const keywordPatterns = keywords.map(
    (k) => new RegExp(k.replace(/\s+/g, '\\s*'), 'i')
  );

  return jobs.filter((job) =>
    keywordPatterns.some((pattern) => pattern.test(job.text))
  );
}

export function scoreLeverJob(
  job: LeverJob,
  roleKeywords: {
    primary: string[];
    secondary: string[];
    tertiary: string[];
  }
): number {
  const title = job.text.toLowerCase();

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
