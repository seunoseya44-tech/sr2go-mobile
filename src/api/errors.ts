import { isAxiosError } from 'axios';

export type ApiErrorKind =
  | 'network'
  | 'timeout'
  | 'unauthorized'
  | 'forbidden'
  | 'validation'
  | 'rateLimited'
  | 'server'
  | 'unknown';

/** Field name -> first error message, from a FastAPI 422 response. */
export type FieldErrors = Partial<Record<string, string>>;

/**
 * One error type for the whole app. Screens only ever deal with `ApiError`,
 * never with raw axios errors, so every failure has a user-safe `message`.
 */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly fieldErrors: FieldErrors;

  constructor(kind: ApiErrorKind, message: string, status?: number, fieldErrors: FieldErrors = {}) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

interface FastApiValidationItem {
  loc?: (string | number)[];
  msg?: string;
}

/** FastAPI returns `{ detail: string }` or `{ detail: [{ loc, msg }] }`. */
function readDetail(data: unknown): { message?: string; fieldErrors: FieldErrors } {
  const fieldErrors: FieldErrors = {};
  if (!data || typeof data !== 'object') return { fieldErrors };

  const detail = (data as { detail?: unknown; message?: unknown }).detail;
  const message = (data as { message?: unknown }).message;

  if (typeof detail === 'string') return { message: detail, fieldErrors };

  if (Array.isArray(detail)) {
    for (const item of detail as FastApiValidationItem[]) {
      const field = item.loc?.[item.loc.length - 1];
      if (typeof field === 'string' && item.msg && !fieldErrors[field]) {
        fieldErrors[field] = item.msg;
      }
    }
    const first = (detail as FastApiValidationItem[])[0]?.msg;
    return { message: first, fieldErrors };
  }

  if (typeof message === 'string') return { message, fieldErrors };
  return { fieldErrors };
}

const FRIENDLY = {
  network: "Can't reach ShareRide2Go. Check your internet connection and try again.",
  timeout: 'The server is taking too long to respond. Please try again.',
  unauthorized: 'Your session has expired. Please sign in again.',
  forbidden: "You don't have access to this.",
  validation: 'Please check the details you entered.',
  rateLimited: 'Too many attempts. Please wait a moment and try again.',
  server: 'Something went wrong on our side. Please try again shortly.',
  unknown: 'Something went wrong. Please try again.',
} satisfies Record<ApiErrorKind, string>;

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (isAxiosError(error)) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new ApiError('timeout', FRIENDLY.timeout);
    }
    if (!error.response) {
      return new ApiError('network', FRIENDLY.network);
    }

    const { status, data } = error.response;
    const { message, fieldErrors } = readDetail(data);

    if (status === 401)
      return new ApiError('unauthorized', message ?? FRIENDLY.unauthorized, status);
    if (status === 403) return new ApiError('forbidden', message ?? FRIENDLY.forbidden, status);
    if (status === 422 || status === 400) {
      return new ApiError('validation', message ?? FRIENDLY.validation, status, fieldErrors);
    }
    if (status === 429) return new ApiError('rateLimited', FRIENDLY.rateLimited, status);
    // Never surface raw 5xx bodies (stack traces, HTML error pages) to users.
    if (status >= 500) return new ApiError('server', FRIENDLY.server, status);
    return new ApiError('unknown', message ?? FRIENDLY.unknown, status);
  }

  return new ApiError('unknown', FRIENDLY.unknown);
}
