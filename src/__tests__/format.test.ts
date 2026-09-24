import type { User } from '../api/types';
import { displayName, greeting, initials, relativeExpiry } from '../utils/format';

const user = (partial: Partial<User>): User => ({
  id: null,
  email: null,
  fullName: null,
  phone: null,
  role: null,
  isVerified: null,
  raw: {},
  ...partial,
});

describe('format helpers', () => {
  it('greets by time of day', () => {
    expect(greeting(new Date(2026, 0, 1, 8))).toBe('Good morning');
    expect(greeting(new Date(2026, 0, 1, 14))).toBe('Good afternoon');
    expect(greeting(new Date(2026, 0, 1, 20))).toBe('Good evening');
  });

  it('derives a display name', () => {
    expect(displayName(user({ fullName: 'Seun Adeyemi' }))).toBe('Seun');
    expect(displayName(user({ email: 'ada@sr2go.com' }))).toBe('Ada');
    expect(displayName(null)).toBe('there');
  });

  it('derives initials', () => {
    expect(initials(user({ fullName: 'Seun Adeyemi' }))).toBe('SA');
    expect(initials(null)).toBe('SR');
  });

  it('formats relative expiry', () => {
    const now = Date.now();
    expect(relativeExpiry(now - 1000, now)).toBe('expired');
    expect(relativeExpiry(now + 30 * 60_000, now)).toBe('in 30 min');
    expect(relativeExpiry(now + 3 * 3_600_000, now)).toBe('in 3 h');
  });
});
