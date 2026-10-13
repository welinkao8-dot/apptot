import { getDriverLocationFreshness } from './driverLocationFreshness';

describe('getDriverLocationFreshness', () => {
  it('waits until the driver sends the first live fix', () => {
    expect(getDriverLocationFreshness(null, 10_000)).toBe('waiting');
  });

  it('marks recent fixes fresh and old/future fixes stale', () => {
    expect(getDriverLocationFreshness(9_000, 10_000)).toBe('fresh');
    expect(getDriverLocationFreshness(1_000, 40_001)).toBe('stale');
    expect(getDriverLocationFreshness(11_000, 10_000)).toBe('stale');
  });
});
