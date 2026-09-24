import { loginSchema } from '../screens/loginSchema';

describe('loginSchema', () => {
  it('accepts a valid email and password and trims the email', () => {
    const result = loginSchema.safeParse({ email: '  rider@sr2go.com ', password: 'x' });
    expect(result.success).toBe(true);
    expect(result.data?.email).toBe('rider@sr2go.com');
  });

  it('requires both fields', () => {
    const result = loginSchema.safeParse({ email: '', password: '' });
    expect(result.success).toBe(false);
    const messages = result.error?.issues.map((issue) => issue.message);
    expect(messages).toEqual(
      expect.arrayContaining(['Enter your email address', 'Enter your password']),
    );
  });

  it('rejects malformed emails', () => {
    expect(loginSchema.safeParse({ email: 'rider@sr2go', password: 'x' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'rider sr2go.com', password: 'x' }).success).toBe(false);
  });

  it('does not trim or restrict passwords', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: ' ' }).data?.password).toBe(' ');
  });
});
