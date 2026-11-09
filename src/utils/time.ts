/**
 * Nigerian time for every ride time on screen (joint test item 9, 29 Oct).
 * The server sends UTC ("…Z" or "+00:00"); Nigeria is UTC+1 all year (no
 * daylight saving), so the app converts explicitly instead of relying on the
 * phone's own time zone. A time without a zone is taken as already local.
 */
import { appConfig } from '../config/appConfig';

/** Martin, 30 Oct: the offset comes from GET /api/app/config (utc_offset_minutes), not the app. */
const offsetMinutes = () => appConfig().utcOffsetMinutes;

export function lagosDateTime(value: string | null | undefined): {
  date: string | null;
  time: string | null;
} {
  if (!value) return { date: null, time: null };
  const s = value.trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) && /(Z|[+-]\d{2}:?\d{2})$/i.test(s)) {
    const ms = Date.parse(s);
    if (!Number.isNaN(ms)) {
      const d = new Date(ms + offsetMinutes() * 60_000);
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

/**
 * 9 Nov 2026 (Martin): times as Nigerians read them - "07:00" -> "7:00 AM", "00:00" -> "12:00 AM", "13:30" ->
 * "1:30 PM". For DISPLAY only: the data keeps "HH:MM" (boarding and booking code compute with it).
 */
export function clock12(hhmm: string | null | undefined): string | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return hhmm;
  const h = Number(m[1]);
  if (h > 23) return hhmm;
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}

/** True when "HH:MM" falls in the night window [fromHour, toHour) that wraps midnight (e.g. 22 -> 5). */
export function isNightTime(hhmm: string, fromHour: number, toHour: number): boolean {
  const h = Number(hhmm.split(':')[0]);
  if (!Number.isFinite(h)) return false;
  return fromHour > toHour ? h >= fromHour || h < toHour : h >= fromHour && h < toHour;
}
