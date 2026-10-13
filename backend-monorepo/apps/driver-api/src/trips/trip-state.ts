export type TripStatus = 'requested' | 'accepted' | 'ongoing' | 'completed' | 'cancelled';

export const tripTransitionTargets: Record<TripStatus, readonly TripStatus[]> = {
  requested: ['accepted', 'cancelled'],
  accepted: ['ongoing', 'cancelled'],
  ongoing: ['completed'],
  completed: [],
  cancelled: [],
};

export function canTransitionTrip(from: TripStatus, to: TripStatus): boolean {
  return tripTransitionTargets[from]?.includes(to) ?? false;
}

export function tripTransitionSources(to: TripStatus): TripStatus[] {
  return (Object.entries(tripTransitionTargets) as [TripStatus, readonly TripStatus[]][])
    .filter(([, targets]) => targets.includes(to))
    .map(([source]) => source);
}
