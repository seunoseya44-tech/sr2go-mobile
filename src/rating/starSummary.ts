/**
 * Martin, 9 Nov 2026: "why is the rating from Seun not appearing here?" - the Reviews page showed only written public
 * reviews; star ratings (Rate your trip / Rate your passengers) were stored but shown nowhere there. Now the page shows
 * the star average as a driver and as a passenger, and the comments left with stars (never who left them).
 */
import { ENDPOINTS, http } from '../api/client';

export interface StarLine {
  label: string;
  average: number;
  count: number;
}

export interface StarComment {
  id: string;
  score: number;
  comment: string;
  asDriver: boolean;
  createdAt: string | null;
}

export function starLines(summary: unknown): StarLine[] {
  const s = (summary ?? {}) as Record<string, { average?: unknown; count?: unknown } | undefined>;
  const out: StarLine[] = [];
  for (const [key, label] of [
    ['as_driver', 'As a driver'],
    ['as_passenger', 'As a passenger'],
  ] as const) {
    const v = s[key];
    const count = Number(v?.count ?? 0);
    const average = Number(v?.average);
    if (count > 0 && Number.isFinite(average)) out.push({ label, average, count });
  }
  return out;
}

export function starComments(list: unknown, max = 5): StarComment[] {
  const rows = Array.isArray(list) ? (list as Record<string, unknown>[]) : [];
  return rows
    .filter((r) => typeof r.comment === 'string' && r.comment.trim() !== '')
    .slice(0, max)
    .map((r) => ({
      id: String(r.id),
      score: Number(r.score) || 0,
      comment: String(r.comment).trim(),
      asDriver: r.rating_context === 'driver',
      createdAt: typeof r.created_at === 'string' ? r.created_at : null,
    }));
}

export function ratingsCount(n: number): string {
  return `${n} rating${n === 1 ? '' : 's'}`;
}

export const starsApi = {
  async summary(userId: string): Promise<StarLine[]> {
    const { data } = await http.get(ENDPOINTS.ratingSummary(userId), { skipSessionHandling: true });
    return starLines(data);
  },
  async comments(userId: string): Promise<StarComment[]> {
    const { data } = await http.get(ENDPOINTS.ratingsOf(userId), { skipSessionHandling: true });
    return starComments(data);
  },
};
