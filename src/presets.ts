// Title presets offered during onboarding. Pick one, then edit freely.
export interface TitleSet {
  primary: string[];
  secondary: string[];
  tertiary: string[];
}

export const PRESETS: { key: string; label: string; titles: TitleSet }[] = [
  {
    key: 'presales',
    label: 'Presales / Solutions / Implementation (customer-facing technical)',
    titles: {
      primary: [
        'Solutions Engineer',
        'Integration Engineer',
        'Technical Consultant',
        'Implementation Consultant',
        'Customer Engineer',
        'Solutions Consultant',
        'Deployment Strategist',
        'Onboarding Engineer',
        'Implementation Engineer',
        'Forward Deployed Engineer',
      ],
      secondary: [
        'Solutions Architect',
        'Professional Services',
        'Technical Account Manager',
        'Customer Success Engineer',
        'Support Engineer',
        'Pre-Sales Engineer',
        'Sales Engineer',
      ],
      tertiary: ['Data Engineer', 'AI Engineer', 'Software Engineer'],
    },
  },
  {
    key: 'swe',
    label: 'Software Engineering',
    titles: {
      primary: ['Software Engineer', 'Backend Engineer', 'Full Stack Engineer', 'Frontend Engineer'],
      secondary: ['Platform Engineer', 'Infrastructure Engineer', 'DevOps Engineer', 'Site Reliability Engineer'],
      tertiary: ['Data Engineer', 'Machine Learning Engineer'],
    },
  },
  {
    key: 'data',
    label: 'Data / Analytics / ML',
    titles: {
      primary: ['Data Engineer', 'Analytics Engineer', 'Data Scientist', 'Data Analyst'],
      secondary: ['Machine Learning Engineer', 'Business Intelligence', 'BI Engineer'],
      tertiary: ['Software Engineer'],
    },
  },
  {
    key: 'product',
    label: 'Product / Program Management',
    titles: {
      primary: ['Product Manager', 'Technical Program Manager', 'Program Manager'],
      secondary: ['Product Operations', 'Implementation Manager', 'Solutions Manager'],
      tertiary: ['Customer Success Manager'],
    },
  },
  {
    key: 'custom',
    label: 'Custom (type your own titles)',
    titles: { primary: [], secondary: [], tertiary: [] },
  },
];
