import { QUICK_REPLIES, quickRepliesFor, withQuickReply } from '../screens/social/quickReplies';

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

describe('a quick reply goes into the box to edit, it is not sent (Martin, 6 Nov 2026)', () => {
  it('fills an empty box with the reply', () => {
    expect(withQuickReply('', 'Running 5 minutes late, please wait.')).toBe(
      'Running 5 minutes late, please wait.',
    );
    expect(withQuickReply('   ', 'On my way.')).toBe('On my way.');
  });
  it('adds the reply after words already typed, keeping them', () => {
    expect(withQuickReply('Hello sir. ', 'On my way.')).toBe('Hello sir. On my way.');
  });
});
