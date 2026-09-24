/** Builds an unsigned JWT with the given claims (signature is irrelevant client-side). */
export function makeJwt(claims: Record<string, unknown>): string {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value))
      .toString('base64')
      .replace(/=+$/, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.signature`;
}

export const nowInSeconds = () => Math.floor(Date.now() / 1000);
