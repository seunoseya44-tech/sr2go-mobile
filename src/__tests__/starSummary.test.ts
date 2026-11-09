import { ratingsCount, starComments, starLines } from '../rating/starSummary';

describe('the Reviews page shows the star ratings too (Martin, 9 Nov 2026)', () => {
  it('shows the average as a driver and as a passenger, only where there are ratings', () => {
    expect(
      starLines({
        as_driver: { average: null, count: 0 },
        as_passenger: { average: 3.0, count: 2 },
      }),
    ).toEqual([{ label: 'As a passenger', average: 3, count: 2 }]);
    expect(
      starLines({ as_driver: { average: 4.7, count: 5 }, as_passenger: { average: 5, count: 1 } }),
    ).toHaveLength(2);
    expect(starLines({})).toEqual([]);
  });
  it('lists the comments left with stars, never who left them', () => {
    const c = starComments([
      {
        id: 6,
        score: 5,
        comment: 'Safe driving, Good music. Nice guy',
        rating_context: 'driver',
        created_at: '2026-11-09T08:27:55Z',
      },
      { id: 7, score: 5, comment: '', rating_context: 'passenger' },
      { id: 5, score: 1, comment: null, rating_context: 'passenger' },
    ]);
    expect(c).toEqual([
      {
        id: '6',
        score: 5,
        comment: 'Safe driving, Good music. Nice guy',
        asDriver: true,
        createdAt: '2026-11-09T08:27:55Z',
      },
    ]);
    expect(JSON.stringify(c)).not.toMatch(/reviewer|from_user/);
  });
  it('counts in words', () => {
    expect(ratingsCount(1)).toBe('1 rating');
    expect(ratingsCount(2)).toBe('2 ratings');
  });
});
