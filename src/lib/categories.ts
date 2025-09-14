export const CATEGORIES = [
  { label: 'ภาษาไทย',                 slug: 'thai' },
  { label: 'คณิตศาสตร์',             slug: 'math' },
  { label: 'วิทยาศาสตร์และเทคโนโลยี', slug: 'sci-tech' },
  { label: 'สังคมศึกษาฯ',            slug: 'social' },
  { label: 'สุขศึกษาและพลศึกษา',     slug: 'health-pe' },
  { label: 'ศิลปะ',                   slug: 'art' },
  { label: 'การงานอาชีพ',             slug: 'work' },
  { label: 'ภาษาต่างประเทศ',          slug: 'foreign-lang' },
  { label: 'ศูนย์เทคโนโลยีสารสนเทศฯ', slug: 'ict-center' },
  { label: 'งานแนะแนว',               slug: 'guidance' },
  { label: 'งานห้องสมุด',             slug: 'library' },
  { label: 'ผู้บริหาร',             slug: 'executive' },
] as const;

export type Category = typeof CATEGORIES[number];