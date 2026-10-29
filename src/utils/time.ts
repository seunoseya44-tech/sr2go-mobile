/**
 * Nigerian time for every ride time on screen (joint test item 9, 29 Oct).
 * The server sends UTC ("…Z" or "+00:00"); Nigeria is UTC+1 all year (no
 * daylight saving), so the app converts explicitly instead of relying on the
 * phone's own time zone. A time without a zone is taken as already local.
 */
const LAGOS_OFFSET_MIN = 60;

export function lagosDateTime(value: string | null | undefined): {
  date: string | null;
  time: string | null;
} {
  if (!value) return { date: null, time: null };
  const s = value.trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) && /(Z|[+-]\d{2}:?\d{2})$/i.test(s)) {
    const ms = Date.parse(s);
    if (!Number.isNaN(ms)) {
      const d = new Date(ms + LAGOS_OFFSET_MIN * 60_000);
      const pad = (n: number) => String(n).padStart(2, '0');
      return {
        date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
        time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
      };
    }
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s))
    return { date: s.slice(0, 10), time: s.slice(11, 16) };
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { date: s, time: null };
  if (/^\d{1,2}:\d{2}/.test(s)) return { date: null, time: s.padStart(5, '0').slice(0, 5) };
  return { date: null, time: null };
}
