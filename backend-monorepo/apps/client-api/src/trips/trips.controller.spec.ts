import { BadRequestException } from '@nestjs/common';
import { TripsController } from './trips.controller';

describe('TripsController history pagination', () => {
  it('passes the page requested by the authenticated client to the history service', () => {
    const getHistory = jest.fn();
    const controller = new TripsController({ getHistory } as never);

    controller.getHistory({ sub: 'client-a' } as never, { limit: '15', status: 'all', page: '3' } as never);

    expect(getHistory).toHaveBeenCalledWith('client-a', 15, 'all', undefined, undefined, undefined, 3);
  });

  it.each([
    [{ limit: '12items' }],
    [{ page: '1.5' }],
    [{ month: '13', year: '2026' }],
    [{ month: '2' }],
    [{ year: '2026' }],
    [{ status: 'pending' }],
    [{ category: 'parcel' }],
    [{ status: ['completed', 'cancelled'] }],
    [{ page: ['1', '2'] }],
  ])('rejects malformed or unsupported history query %j', (query) => {
    const controller = new TripsController({ getHistory: jest.fn() } as never);

    expect(() => controller.getHistory({ sub: 'client-a' } as never, query as never)).toThrow(BadRequestException);
  });

  it('converts one-based month input to the service Date month and uses the JWT subject', () => {
    const getHistory = jest.fn();
    const controller = new TripsController({ getHistory } as never);

    controller.getHistory({ sub: 'client-a' } as never, { month: '2', year: '2026', category: 'delivery' } as never);

    expect(getHistory).toHaveBeenCalledWith('client-a', 20, undefined, 1, 2026, 'delivery', 1);
  });
});
