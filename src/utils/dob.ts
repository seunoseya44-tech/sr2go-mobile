/**
 * Date of birth typing (joint test fix 1, 29 Oct): the user may type slashes
 * ("14/1/1990") or digits only ("14011990"); both end up as 14/01/1990.
 */

/** Keeps digits and slashes, turns "-", "." and spaces into "/", inserts slashes after DD and MM when typing digits only. */
export function formatDobInput(raw: string): string {
  const t = raw
    .replace(/[-.\s]/g, '/')
    .replace(/[^\d/]/g, '')
    .replace(/\/{2,}/g, '/');
  if (!t.includes('/')) {
    const d = t.slice(0, 8);
    if (d.length > 4) return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
    if (d.length > 2) return `${d.slice(0, 2)}/${d.slice(2)}`;
    return d;
  }
  const [day = '', month = '', year = '', ...rest] = t.split('/');
  if (rest.length) return [day, month, year].join('/');
  return [day.slice(0, 2), month.slice(0, 2), year.slice(0, 4)].join('/').slice(0, t.length);
}

/** "14/1/1990" or "14/01/1990" → "1990-01-14"; null when incomplete or not a real date. */
export function parseDob(value: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
