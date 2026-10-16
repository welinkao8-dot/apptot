import { BadRequestException } from '@nestjs/common';
import { TripsController } from './trips.controller';
import { InvalidDriverLocationError } from '../rides/rides.gateway';

describe('TripsController driver location upload', () => {
  const tripsService = {};
  const ridesGateway = { processDriverLocation: jest.fn() };
  const paymentsService = {};
  let controller: TripsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new TripsController(tripsService as never, ridesGateway as never, paymentsService as never);
  });

  it('uses the authenticated driver identity and shared GPS pipeline', async () => {
    const fix = { lat: -8.84, lng: 13.29, accuracy: 8, timestamp: Date.now() };
    ridesGateway.processDriverLocation.mockResolvedValue({ success: true });

    await expect(controller.updateLocation(fix, { sub: 'driver-a', role: 'driver' } as never)).resolves.toEqual({ success: true });

    expect(ridesGateway.processDriverLocation).toHaveBeenCalledWith('driver-a', fix);
  });

  it('returns a client error for invalid GPS fixes', async () => {
    ridesGateway.processDriverLocation.mockRejectedValue(new InvalidDriverLocationError('Coordenadas GPS inválidas.'));

    await expect(controller.updateLocation({ lat: 200, lng: 13.29 }, { sub: 'driver-a', role: 'driver' } as never))
      .rejects.toThrow(BadRequestException);
  });

  it('does not disguise a persistence failure as invalid client input', async () => {
    const databaseError = new Error('database unavailable');
    ridesGateway.processDriverLocation.mockRejectedValue(databaseError);

    await expect(controller.updateLocation({ lat: -8.84, lng: 13.29 }, { sub: 'driver-a', role: 'driver' } as never))
      .rejects.toBe(databaseError);
  });
});
