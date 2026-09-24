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
  const source = user?.fullName ?? user?.email ?? '';
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[1]?.[0] ?? '') : '');
  return letters.toUpperCase() || 'SR';
}

export function capitalize(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
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
