import { QUICK_REPLIES, quickRepliesFor } from '../screens/social/quickReplies';

describe('trip chat quick replies (6 Nov 2026)', () => {
  it('gives the driver and the passenger their own one-tap messages', () => {
    expect(quickRepliesFor('driver')).toContain("I'm at the meeting point.");
    expect(quickRepliesFor('passenger')).toContain('On my way.');
    expect(quickRepliesFor('driver')).not.toEqual(quickRepliesFor('passenger'));
  });

  it('keeps every reply short enough for one chip and free of duplicates', () => {
    for (const list of Object.values(QUICK_REPLIES)) {
      expect(new Set(list).size).toBe(list.length);
      for (const q of list) expect(q.length).toBeLessThanOrEqual(40);
    }
  });
});
