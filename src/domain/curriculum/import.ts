import type { CurriculumData } from '../../types';
import { validateCurriculum } from './validation';

const headers = new Set([
  'id',
  'order',
  'title',
  'slug',
  'module',
  'pattern',
  'difficulty',
  'platform',
  'problemUrl',
  'sourceUrl',
]);
const requiredHeaders = ['id', 'order', 'title', 'module', 'platform', 'problemUrl'];

/** RFC 4180-style parser: escaped quotes, quoted commas/newlines, LF and CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  let closedQuote = false;
  const source = text.replace(/^\uFEFF/, '');
  function field() {
    row.push(value);
    value = '';
    closedQuote = false;
  }
  function line() {
    field();
    if (row.some((cell) => cell.trim() !== '')) rows.push(row);
    row = [];
  }
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]!;
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        value += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
        closedQuote = true;
      } else value += char;
    } else if (char === ',') field();
    else if (char === '\n') line();
    else if (char === '\r') {
      if (source[i + 1] === '\n') i += 1;
      line();
    } else if (char === '"' && value === '' && !closedQuote) quoted = true;
    else {
      if (closedQuote || char === '"') throw new Error(`Malformed CSV near character ${i + 1}.`);
      value += char;
    }
  }
  if (quoted) throw new Error('CSV contains an unterminated quoted field.');
  if (value || row.length || closedQuote) line();
  return rows;
}

export function curriculumFromCsv(text: string, metadata: unknown): CurriculumData {
  const [heading, ...rows] = parseCsv(text);
  if (!heading || rows.length === 0)
    throw new Error('CSV must contain a header and at least one problem.');
  const names = heading.map((name) => name.trim());
  if (new Set(names).size !== names.length) throw new Error('CSV contains duplicate headers.');
  for (const name of names)
    if (!headers.has(name))
      throw new Error(`Unknown CSV header: ${name}. Only navigation metadata is supported.`);
  for (const name of requiredHeaders)
    if (!names.includes(name)) throw new Error(`Missing CSV header: ${name}.`);
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata))
    throw new Error('CSV metadata must be a JSON object.');
  const problems = rows.map((cells, index) => {
    if (cells.length !== names.length)
      throw new Error(`CSV row ${index + 2} has ${cells.length} fields; expected ${names.length}.`);
    const problem: Record<string, unknown> = {};
    names.forEach((name, i) => {
      const cell = cells[i]!.trim();
      if (cell) problem[name] = name === 'order' ? Number(cell) : cell;
    });
    return problem;
  });
  return validateCurriculum({ ...metadata, problems });
}

/** Stable source identities keep saved attempts attached when the sheet is reordered. */
export function assertStableProblemIds(previous: CurriculumData, next: CurriculumData): void {
  const existing = new Map(previous.problems.map((problem) => [problem.id, problem]));
  const sourceIds = new Map(
    previous.problems
      .filter((problem) => problem.sourceUrl)
      .map((problem) => [problem.sourceUrl!, problem.id]),
  );
  for (const problem of next.problems) {
    const old = existing.get(problem.id);
    if (old?.sourceUrl && problem.sourceUrl && old.sourceUrl !== problem.sourceUrl) {
      throw new Error(
        `ID ${problem.id} was reassigned to another source. Preserve the original id/sourceUrl pair to protect saved progress.`,
      );
    }
    const oldId = problem.sourceUrl ? sourceIds.get(problem.sourceUrl) : undefined;
    if (oldId && oldId !== problem.id) {
      throw new Error(
        `Source ${problem.sourceUrl} previously used id ${oldId}. Keep that id to preserve progress.`,
      );
    }
  }
}
