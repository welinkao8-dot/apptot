import { canTransitionTrip, tripTransitionTargets } from './trip-state';

describe('trip lifecycle transitions', () => {
  it.each([
    ['requested', 'accepted', true],
    ['accepted', 'ongoing', true],
    ['ongoing', 'completed', true],
    ['requested', 'cancelled', true],
    ['accepted', 'cancelled', true],
    ['ongoing', 'cancelled', false],
    ['completed', 'cancelled', false],
    ['cancelled', 'accepted', false],
    ['accepted', 'accepted', false],
  ] as const)('allows %s → %s: %s', (from, to, expected) => {
    expect(canTransitionTrip(from, to)).toBe(expected);
  });

  it('exposes only the allowed next states for a current state', () => {
    expect(tripTransitionTargets.requested).toEqual(['accepted', 'cancelled']);
    expect(tripTransitionTargets.accepted).toEqual(['ongoing', 'cancelled']);
    expect(tripTransitionTargets.ongoing).toEqual(['completed']);
    expect(tripTransitionTargets.completed).toEqual([]);
    expect(tripTransitionTargets.cancelled).toEqual([]);
  });
});
