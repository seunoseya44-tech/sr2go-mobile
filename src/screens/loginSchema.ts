import { z } from 'zod';

// Pragmatic email check: the server does the authoritative validation, this
// only catches obvious typos before a network round-trip.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Enter your email address')
    .regex(EMAIL_PATTERN, 'Enter a valid email address'),
  // Don't enforce password rules on login: that would lock out users whose
  // passwords predate a rule change. Only require that something was typed.
  password: z.string().min(1, 'Enter your password'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
