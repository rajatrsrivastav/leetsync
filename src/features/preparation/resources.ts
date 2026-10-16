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
    title: 'HLD — Primary',
    group: 'System Design',
    subjects: ['system'],
    url: 'https://github.com/ashishps1/awesome-system-design-resources',
    description: 'System design concepts and interview preparation resources.',
  },
  {
    id: 'hld-additional',
    title: 'HLD — Additional',
    group: 'System Design',
    subjects: ['system'],
    url: 'https://github.com/donnemartin/system-design-primer',
    description: 'The System Design Primer: large-scale systems and design practice.',
  },
  {
    id: 'lld',
    title: 'LLD / Object-oriented design',
    group: 'System Design',
    subjects: ['system', 'oop'],
    url: 'https://github.com/ashishps1/awesome-low-level-design',
    description: 'Low-level design, object-oriented design, and design patterns.',
  },
  {
    id: 'aptitude',
    title: 'Aptitude practice',
    group: 'Aptitude',
    subjects: ['aptitude'],
    url: 'https://www.indiabix.com/aptitude/',
    description: 'Quantitative aptitude questions and practice on IndiaBIX.',
  },
  {
    id: 'interviews',
    title: 'Tech Interview Handbook',
    group: 'Interviews',
    subjects: ['interviews'],
    url: 'https://github.com/yangshun/tech-interview-handbook',
    description: 'Technical interview preparation, resumes, and interview process guidance.',
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
