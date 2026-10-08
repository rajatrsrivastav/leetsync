/** Calendar keys intentionally use the browser's local timezone, never UTC. */
export function localDate(date = new Date()): string {
  if (Number.isNaN(date.getTime())) throw new RangeError('Invalid date');
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Noon avoids missing local midnights in timezones with midnight DST changes. */
export function parseLocalDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new RangeError(`Invalid local date: ${value}`);
  const [, year, month, day] = match;
  const result = new Date(Number(year), Number(month) - 1, Number(day), 12);
  if (localDate(result) !== value) throw new RangeError(`Invalid local date: ${value}`);
  return result;
}

/** Add calendar days, not 24-hour durations: local dates remain correct across DST. */
export function addLocalDays(date: Date, days: number): Date {
  if (!Number.isInteger(days)) throw new RangeError('Days must be an integer');
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function addDateKeyDays(date: string, days: number): string {
  return localDate(addLocalDays(parseLocalDate(date), days));
}

/** Convert either stored ISO timestamps or calendar keys into local day keys. */
export function dateKeyFromTimestamp(value: string): string | null {
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return localDate(parseLocalDate(value));
    return localDate(new Date(value));
  } catch {
    return null;
  }
}

export function isDueOnOrBefore(value: string | undefined, now = new Date()): boolean {
  if (!value) return false;
  const key = dateKeyFromTimestamp(value);
  return key !== null && key <= localDate(now);
}
