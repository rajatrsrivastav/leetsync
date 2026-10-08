import bundledData from '../../data/curricula/striver180.json';
import type {
  CurriculumData,
  CurriculumModule,
  CurriculumProblem,
  ProgressState,
} from '../../types';
import { validateCurriculum } from './validation';

export interface CurriculumProvider {
  readonly data: CurriculumData;
  getModules(): CurriculumModule[];
  getProblems(): CurriculumProblem[];
  getNextProblem(progress: ProgressState): CurriculumProblem | null;
  getProblem(id: string): CurriculumProblem | undefined;
  getBySlug(slug: string): CurriculumProblem | undefined;
}

const completed = new Set(['independent', 'assisted', 'relearn']);

/** A versioned, local snapshot. Reading it never makes a network request. */
export class Striver180CurriculumProvider implements CurriculumProvider {
  readonly data: CurriculumData;

  constructor(data: unknown = bundledData) {
    this.data = validateCurriculum(data);
  }

  getProblems(): CurriculumProblem[] {
    return this.data.problems.map((problem) => ({ ...problem }));
  }

  getModules(): CurriculumModule[] {
    const modules = new Map<string, CurriculumModule>();
    for (const problem of this.getProblems()) {
      const title = problem.module;
      if (!modules.has(title))
        modules.set(title, {
          id: title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, ''),
          title,
          problems: [],
        });
      modules.get(title)!.problems.push(problem);
    }
    return [...modules.values()];
  }

  getNextProblem(progress: ProgressState): CurriculumProblem | null {
    return (
      this.getProblems().find(
        (problem) => !completed.has(progress[problem.id]?.state ?? 'not_started'),
      ) ?? null
    );
  }

  getProblem(id: string): CurriculumProblem | undefined {
    const problem = this.data.problems.find((item) => item.id === id);
    return problem ? { ...problem } : undefined;
  }

  /** Some patterns reuse a platform problem. Prefer the active attempt's id when known. */
  getBySlug(slug: string): CurriculumProblem | undefined {
    return this.getAllBySlug(slug)[0];
  }

  getAllBySlug(slug: string): CurriculumProblem[] {
    return this.getProblems().filter(
      (problem) => problem.platform === 'leetcode' && problem.slug === slug,
    );
  }
}

export const curriculum = new Striver180CurriculumProvider();
