import { formatDobInput, parseDob } from '../utils/dob';

describe('date of birth input', () => {
  it('formats digits only with slashes', () => {
    expect(formatDobInput('14')).toBe('14');
    expect(formatDobInput('1401')).toBe('14/01');
    expect(formatDobInput('14011990')).toBe('14/01/1990');
  });

  it('keeps typed slashes and single-digit day or month', () => {
    expect(formatDobInput('14/')).toBe('14/');
    expect(formatDobInput('14/1/1990')).toBe('14/1/1990');
    expect(formatDobInput('4-1-1990')).toBe('4/1/1990');
    expect(formatDobInput('14//1')).toBe('14/1');
  });

  it('parses to ISO and pads day and month', () => {
    expect(parseDob('14/1/1990')).toBe('1990-01-14');
    expect(parseDob('14/01/1990')).toBe('1990-01-14');
    expect(parseDob('4/1/1990')).toBe('1990-01-04');
  });

  it('rejects incomplete or impossible dates', () => {
    expect(parseDob('14/1')).toBeNull();
    expect(parseDob('31/02/1990')).toBeNull();
    expect(parseDob('14/13/1990')).toBeNull();
  });
});
