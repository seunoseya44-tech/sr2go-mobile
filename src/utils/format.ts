import { lagosDateTime } from './time';
import type { User } from '../api/types';

export function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** First name for greetings, falling back to the email's local part. */
export function displayName(user: User | null): string {
  const first = user?.fullName?.split(/\s+/)[0];
  if (first) return first;
  const local = user?.email?.split('@')[0];
  if (local) return local.charAt(0).toUpperCase() + local.slice(1);
  return 'there';
}

export function initials(user: User | null): string {
  return initialsOf(user?.fullName ?? user?.email ?? '');
}

/** "Chinedu.O" -> "CO", "Aisha Bello" -> "AB". */
export function initialsOf(name: string): string {
  const parts = name.split(/[\s@._-]+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[1]?.[0] ?? '') : '');
  return letters.toUpperCase() || 'SR';
}

export function capitalize(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Formats a money string from the API as "₦3,900" or "₦3,900.50". The app
 * never rounds: kobo are shown only when the value has them.
 */
export function naira(value: string | number | null | undefined): string {
  if (value == null || value === '') return '';
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return `₦${value}`;
  const hasKobo = Math.abs(n - Math.trunc(n)) > 0.000001;
  const formatted = n.toLocaleString('en-NG', {
    minimumFractionDigits: hasKobo ? 2 : 0,
    maximumFractionDigits: hasKobo ? 2 : 0,
  });
  return `₦${formatted}`;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-10-03" -> "Fri 3 Oct". Invalid input is returned as-is. */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  // Item 9: a full UTC timestamp is read in Nigerian time, so the day is right after 23:00 UTC.
  const day = /T\d{2}:\d{2}/.test(iso) ? (lagosDateTime(iso).date ?? iso) : iso;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return iso;
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "Fri, 3 Oct" for chips. */
export function chipDate(iso: string): string {
  const s = shortDate(iso);
  return s.replace(/^(\w{3}) /, '$1, ');
}

/** Today in local time as YYYY-MM-DD. */
export function isoDate(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(iso: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days);
  return isoDate(d);
}

/** "Saloon" -> "Saloon car", "Hiace" -> "Hiace bus" (brief's status table). */
export function vehicleLabel(type: string | null): string {
  if (!type) return '';
  const t = type.toLowerCase();
  if (t === 'saloon') return 'Saloon car';
  if (t === 'hiace') return 'Hiace bus';
  return capitalize(type);
}

/** Masks a phone for the OTP screen: "+2348031234521" -> "+234 803 *** 4521". */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return 'your number';
  const digits = phone.replace(/\D/g, '');
  const local = digits.startsWith('234') ? digits.slice(3) : digits.replace(/^0/, '');
  if (local.length < 7) return phone;
  return `+234 ${local.slice(0, 3)} *** ${local.slice(-4)}`;
}

/** "in 45 min", "in 2 h", "expired". Coarse on purpose; it's a status hint. */
export function relativeExpiry(expiresAt: number, now = Date.now()): string {
  const diffMin = Math.round((expiresAt - now) / 60_000);
  if (diffMin <= 0) return 'expired';
  if (diffMin < 60) return `in ${diffMin} min`;
  const hours = Math.round(diffMin / 60);
  if (hours < 48) return `in ${hours} h`;
  return `in ${Math.round(hours / 24)} days`;
}
