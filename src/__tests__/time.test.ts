import { lagosDateTime } from '../utils/time';

describe('lagosDateTime', () => {
  it('converts UTC to Nigerian time (UTC+1)', () => {
    expect(lagosDateTime('2026-10-30T06:00:00Z')).toEqual({ date: '2026-10-30', time: '07:00' });
    expect(lagosDateTime('2026-10-30T06:00:00+00:00')).toEqual({
      date: '2026-10-30',
      time: '07:00',
    });
  });

  it('rolls over midnight', () => {
    expect(lagosDateTime('2026-10-30T23:30:00Z')).toEqual({ date: '2026-10-31', time: '00:30' });
  });

  it('respects an offset already given', () => {
    expect(lagosDateTime('2026-10-30T07:00:00+01:00')).toEqual({
      date: '2026-10-30',
      time: '07:00',
    });
  });

  it('keeps a time without a zone as it is', () => {
    expect(lagosDateTime('2026-10-30T07:00:00')).toEqual({ date: '2026-10-30', time: '07:00' });
    expect(lagosDateTime('7:05')).toEqual({ date: null, time: '07:05' });
    expect(lagosDateTime(null)).toEqual({ date: null, time: null });
  });
});
