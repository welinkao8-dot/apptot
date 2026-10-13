import { DatabaseHealthController } from './database-health.controller';

describe('DatabaseHealthController', () => {
  it('reports ready only after the database responds', async () => {
    const query = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
    const controller = new DatabaseHealthController({ $queryRawUnsafe: query } as never);
    await expect(controller.check()).resolves.toEqual({ status: 'ok' });
    expect(query).toHaveBeenCalledWith('SELECT 1');
  });

  it('fails readiness if the database cannot be reached', async () => {
    const error = new Error('database unavailable');
    const controller = new DatabaseHealthController({ $queryRawUnsafe: jest.fn().mockRejectedValue(error) } as never);
    await expect(controller.check()).rejects.toBe(error);
  });
});
