import { AxiosError, AxiosHeaders } from 'axios';

import { toApiError } from '../api/errors';

it('shows the server message for MEETING_POINT_NOT_FOUND (422)', () => {
  const message =
    'We could not find "Behind the old market" on the map. Pick a place from the list.';
  const err = new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    status: 422,
    statusText: 'Unprocessable Entity',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { detail: { error: 'MEETING_POINT_NOT_FOUND', message } },
  });
  const e = toApiError(err);
  expect(e.code).toBe('MEETING_POINT_NOT_FOUND');
  expect(e.message).toBe(message);
});
