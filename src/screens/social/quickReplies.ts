/**
 * One-tap replies in the trip chat (Martin, 6 Nov 2026): drivers and passengers
 * send the usual pickup messages without typing - faster, and safer for a
 * driver near the car. The phone keyboard's own suggestions stay on for
 * anything typed. These are interface words, like button labels: changing one
 * needs only this list.
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
