import { fromDateTimeLocalInput, toDateTimeLocalInput } from '../datetime-local';

/** Holds in any zone; meaningful where the offset is not zero (e.g. TZ=Asia/Riyadh). */
describe('document date in a datetime-local field', () => {
  it('shows the stored instant in local time', () => {
    const offsetMinutes = new Date('2026-11-06T10:34:00.000Z').getTimezoneOffset();
    const local = new Date(Date.parse('2026-11-06T10:34:00.000Z') - offsetMinutes * 60_000);
    expect(toDateTimeLocalInput('2026-11-06T10:34:00.000Z')).toBe(local.toISOString().slice(0, 16));
  });

  it('saving without editing keeps the same instant (no drift by the UTC offset)', () => {
    const stored = '2026-11-06T10:34:00.000Z';
    expect(fromDateTimeLocalInput(toDateTimeLocalInput(stored))).toBe(stored);
  });

  it('a document just after local midnight stays on its day', () => {
    const stored = '2026-11-05T22:30:00.000Z';
    const roundTrip = fromDateTimeLocalInput(toDateTimeLocalInput(stored));
    expect(roundTrip).toBe(stored);
  });

  it('empty input gives null', () => {
    expect(toDateTimeLocalInput(null)).toBe('');
    expect(fromDateTimeLocalInput('')).toBeNull();
  });
});
