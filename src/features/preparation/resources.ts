import type { SubjectId } from './types';

export type TrackedResource = {
  id: string;
  title: string;
  group: string;
  subjects: SubjectId[];
  url: string;
  description: string;
};

// Original destinations checked on 2026-10-17. Opening is never completion evidence.
export const trackedResources: TrackedResource[] = [
  {
    id: 'striver',
    title: 'Striver’s 179-problem sheet',
    group: 'DSA',
    subjects: ['dsa'],
    url: 'https://takeuforward.org/prep-hub/strivers-180-master-dsa-patterns',
    description:
      'The existing Striver curriculum. Solves remain tracked through your DSA workflow.',
  },
  {
    id: 'dsa-patterns',
    title: 'DSA concepts & patterns',
    group: 'DSA',
    subjects: ['dsa'],
    url: 'https://github.com/ashishps1/awesome-leetcode-resources',
    description: 'A collection of coding interview concepts and practice resources.',
  },
  {
    id: 'core-cs-questions',
    title: 'Core CS Interview Prep — 500 questions',
    group: 'Core CS',
    subjects: ['os', 'dbms', 'networks', 'oop', 'sql'],
    url: 'https://github.com/kratos0718/core-cs-interview-prep',
    description:
      'OS, DBMS, SQL, networks, and OOP interview questions with explained answers, ordered basic to advanced. The roadmap links straight into its sections.',
  },
  {
    id: 'core-cs',
    title: 'Core CS interview fundamentals',
    group: 'Core CS',
    subjects: ['os', 'dbms', 'networks', 'oop'],
    url: 'https://github.com/aashishbharti04/cs-fundamentals-for-interviews',
    description:
      'Operating systems, databases, computer networks, and object-oriented programming.',
  },
  {
    id: 'hld-primary',
    title: 'Awesome System Design Resources',
    group: 'System Design',
    subjects: ['system'],
    url: 'https://github.com/ashishps1/awesome-system-design-resources',
    description:
      'Concept articles, trade-offs, and graded design problems. Roadmap design exercises link to its problem pages.',
  },
  {
    id: 'hld-additional',
    title: 'System Design Primer',
    group: 'System Design',
    subjects: ['system'],
    url: 'https://github.com/donnemartin/system-design-primer',
    description:
      'Large-scale system topics with worked design exercises such as Pastebin, Twitter, and a web crawler.',
  },
  {
    id: 'lld',
    title: 'Awesome Low-Level Design',
    group: 'System Design',
    subjects: ['system', 'oop'],
    url: 'https://github.com/ashishps1/awesome-low-level-design',
    description:
      'OOP fundamentals, design patterns, UML, concurrency, and machine-coding problems with requirements and reference solutions.',
  },
  {
    id: 'aptitude',
    title: 'Aptitude practice',
    group: 'Aptitude',
    subjects: ['aptitude'],
    url: 'https://www.indiabix.com/aptitude/questions-and-answers/',
    description:
      'Quantitative aptitude, logical reasoning, and data interpretation questions on IndiaBIX.',
  },
  {
    id: 'interviews',
    title: 'Tech Interview Handbook',
    group: 'Interviews',
    subjects: ['interviews'],
    url: 'https://www.techinterviewhandbook.org/software-engineering-interview-guide/',
    description:
      'Self-introduction, resume, behavioral stories, coding-interview conduct, and offer guidance.',
  },
  {
    id: 'company',
    title: 'Company-wise questions',
    group: 'Company',
    subjects: ['company'],
    url: 'https://github.com/snehasishroy/leetcode-companywise-interview-questions',
    description:
      'July 2026 snapshot. Historical company tags, not live question frequency or a prediction of your interview.',
  },
];
export const resourceById = (id: string) => trackedResources.find((resource) => resource.id === id);
export const resourceForSubject = (subject: SubjectId) =>
  trackedResources.find((r) => r.subjects.includes(subject));
