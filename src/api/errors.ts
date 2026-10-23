import { isAxiosError } from 'axios';

export type ApiErrorKind =
  | 'network'
  | 'timeout'
  | 'unauthorized'
  | 'forbidden'
  | 'notFound'
  | 'validation'
  | 'conflict'
  | 'rateLimited'
  | 'gone'
  | 'server'
  | 'unknown';

/** Field name -> first error message, from a FastAPI 422 response. */
export type FieldErrors = Partial<Record<string, string>>;

/**
 * Extra data the SR2Go backend attaches to some errors (`detail` as an
 * object). Everything is optional; screens read only what they need.
 */
export interface ApiErrorExtra {
  /** Machine code, e.g. `invalid_credentials`, `login_locked`, `kyc_required`, `already_paid`. */
  code?: string;
  attemptsLeft?: number;
  retryAfterMinutes?: number;
  /** Payment reference returned with `already_paid`. */
  reference?: string;
  /** KYC flags returned with `kyc_required`. */
  hasSelfie?: boolean;
  ninVerified?: boolean;
  bankVerified?: boolean;
  bankRequired?: boolean;
  /** 409 open_items on delete account: one line per open item. */
  reasons?: string[];
}

/**
 * One error type for the whole app. Screens only ever deal with `ApiError`,
 * never with raw axios errors, so every failure has a user-safe `message`.
 *
 * The backend returns readable messages; the rule is to show them as given
 * (`detail.message` when `detail` is an object, otherwise `detail` itself)
 * and never raw codes or stack traces.
 */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly fieldErrors: FieldErrors;
  readonly extra: ApiErrorExtra;

  constructor(
    kind: ApiErrorKind,
    message: string,
    status?: number,
    fieldErrors: FieldErrors = {},
    extra: ApiErrorExtra = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.extra = extra;
  }

  get code(): string | undefined {
    return this.extra.code;
  }
}

interface FastApiValidationItem {
  loc?: (string | number)[];
  msg?: string;
}

interface Detail {
  message?: string;
  fieldErrors: FieldErrors;
  extra: ApiErrorExtra;
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function bool(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

/** Strips a leading `ERR_0xx — ` prefix; users must never see raw codes. */
export function stripErrorCode(message: string): string {
  return message.replace(/^ERR_\d+\s*[—–-]\s*/i, '').trim();
}

/**
 * The backend uses three shapes:
 *  - `{ detail: "text" }` (sometimes prefixed with an ERR_0xx code)
 *  - `{ detail: [{ loc, msg, type }] }` for 422 validation
 *  - `{ detail: { error, message, ...fields } }` for login, KYC and payment cases
 */
function readDetail(data: unknown): Detail {
  const fieldErrors: FieldErrors = {};
  const extra: ApiErrorExtra = {};
  if (!data || typeof data !== 'object') return { fieldErrors, extra };

  const detail = (data as { detail?: unknown }).detail;
  const topMessage = (data as { message?: unknown }).message;

  if (typeof detail === 'string') return { message: stripErrorCode(detail), fieldErrors, extra };

  if (Array.isArray(detail)) {
    for (const item of detail as FastApiValidationItem[]) {
      const field = item.loc?.[item.loc.length - 1];
      if (typeof field === 'string' && item.msg && !fieldErrors[field]) {
        fieldErrors[field] = item.msg;
      }
    }
    const first = (detail as FastApiValidationItem[])[0]?.msg;
    return { message: first, fieldErrors, extra };
  }

  if (detail && typeof detail === 'object') {
    const d = detail as Record<string, unknown>;
    if (typeof d.error === 'string') extra.code = d.error;
    extra.attemptsLeft = num(d.attempts_left);
    extra.retryAfterMinutes = num(d.retry_after_minutes);
    if (typeof d.reference === 'string') extra.reference = d.reference;
    extra.hasSelfie = bool(d.has_selfie);
    extra.ninVerified = bool(d.nin_verified);
    extra.bankVerified = bool(d.bank_verified);
    extra.bankRequired = bool(d.bank_required);
    if (Array.isArray(d.reasons)) {
      const reasons = d.reasons
        .map((r) => (r && typeof r === 'object' ? (r as { message?: unknown }).message : r))
        .filter((m): m is string => typeof m === 'string' && m.length > 0);
      if (reasons.length) extra.reasons = reasons;
    }
    const message = typeof d.message === 'string' ? stripErrorCode(d.message) : undefined;
    return { message, fieldErrors, extra };
  }

  if (typeof topMessage === 'string') {
    return { message: stripErrorCode(topMessage), fieldErrors, extra };
  }
  return { fieldErrors, extra };
}

const FRIENDLY = {
  network: "Can't reach ShareRide2Go. Check your internet connection and try again.",
  timeout: 'The server is taking too long to respond. Please try again.',
  unauthorized: 'Your session has expired. Please log in again.',
  forbidden: "You don't have access to this.",
  notFound: "We couldn't find that.",
  validation: 'Please check the details you entered.',
  conflict: 'That has just changed. Please try again.',
  rateLimited: 'Too many attempts. Please wait a moment and try again.',
  gone: 'This is no longer available.',
  server: 'Something went wrong on our side. Please try again shortly.',
  unknown: 'Something went wrong. Please try again.',
} satisfies Record<ApiErrorKind, string>;

function kindFor(status: number): ApiErrorKind {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'notFound';
  if (status === 409) return 'conflict';
  if (status === 410) return 'gone';
  if (status === 422 || status === 400) return 'validation';
  if (status === 429) return 'rateLimited';
  if (status >= 500) return 'server';
  return 'unknown';
}

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
    const { message, fieldErrors, extra } = readDetail(data);
    const kind = kindFor(status);

    // Never surface raw 5xx bodies (stack traces, HTML error pages) to users,
    // except the backend's own worded 503s (e.g. "We could not check your
    // earlier payment"), which arrive as a plain `detail` string.
    if (kind === 'server' && !(status === 503 && message)) {
      return new ApiError('server', FRIENDLY.server, status);
    }
    return new ApiError(kind, message ?? FRIENDLY[kind], status, fieldErrors, extra);
  }

  return new ApiError('unknown', FRIENDLY.unknown);
}
