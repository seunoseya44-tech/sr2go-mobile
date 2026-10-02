import { z } from 'zod';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Nigerian mobile numbers: 10 digits after +234 (leading 0 is stripped).
const NG_LOCAL = /^[1-9]\d{9}$/;
// Brief: minimum 8 characters, at least one special character. The same rule
// is shown on sign-up, set new password and change password.
export const PASSWORD_RULE = 'At least 8 characters, including one symbol';
const PASSWORD_PATTERN = /[^A-Za-z0-9]/;

export function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  const local = digits.startsWith('234') ? digits.slice(3) : digits.replace(/^0/, '');
  return local;
}

export const signUpSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name'),
  email: z
    .string()
    .trim()
    .min(1, 'Enter your email address')
    .regex(EMAIL_PATTERN, 'Enter a valid email address'),
  phone: z
    .string()
    .transform(normalisePhone)
    .refine((v) => NG_LOCAL.test(v), 'Enter a valid Nigerian mobile number'),
  password: z
    .string()
    .min(8, PASSWORD_RULE)
    .refine((v) => PASSWORD_PATTERN.test(v), PASSWORD_RULE),
  role: z.enum(['passenger', 'driver']),
  referralCode: z.string().trim().optional(),
  agreed: z.boolean().refine((v) => v, 'Please confirm you are 18 or older and agree to the terms'),
});

export type SignUpFormValues = z.input<typeof signUpSchema>;
export type SignUpValues = z.output<typeof signUpSchema>;

export const forgotSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Enter your email address')
    .regex(EMAIL_PATTERN, 'Enter a valid email address'),
});
export type ForgotFormValues = z.infer<typeof forgotSchema>;
