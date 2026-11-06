/**
 * One-tap replies in the trip chat (Martin, 6 Nov 2026): drivers and passengers
 * send the usual pickup messages without typing - faster, and safer for a
 * driver near the car. The phone keyboard's own suggestions stay on for
 * anything typed. These are interface words, like button labels: changing one
 * needs only this list.
 *
 * A tap does NOT send (Martin, 6 Nov 2026): it puts the words in the message
 * box, so "5 minutes" can become "10 minutes" or a line can be added, and the
 * person taps Send when it says what they mean.
 */
import type { AppMode } from '../../state/mode';

export const QUICK_REPLIES: Record<AppMode, readonly string[]> = {
  driver: [
    "I'm at the meeting point.",
    'On my way to the meeting point.',
    'Running 10 minutes late, sorry.',
    'Please be at the meeting point on time.',
    "We're leaving in 5 minutes.",
    'Thank you for travelling with me.',
  ],
  passenger: [
    'On my way.',
    "I'm at the meeting point.",
    'Running 5 minutes late, please wait.',
    'Where exactly are you parked?',
    'I can see the car.',
    'Thank you for the ride.',
  ],
};

/** The replies for this side of the trip. */
export function quickRepliesFor(mode: AppMode): readonly string[] {
  return QUICK_REPLIES[mode] ?? QUICK_REPLIES.passenger;
}

/**
 * The message box after tapping a quick reply: an empty box gets the reply; a box
 * that already has words gets the reply added after them, so nothing typed is lost.
 */
export function withQuickReply(current: string, reply: string): string {
  const before = current.trimEnd();
  return before ? `${before} ${reply}` : reply;
}
