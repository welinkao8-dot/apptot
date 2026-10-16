import { validate } from 'class-validator';
import { AdminStatusDto, DriverStatusDto, DriverToggleStatusDto, DriverVehicleCategoryDto } from './admin-status.dto';

describe('admin status request contracts', () => {
  it.each(['active', 'approved', 'rejected', 'suspended'])(
    'accepts driver status %s used by the admin workflow',
    async status => {
      const errors = await validate(Object.assign(new DriverStatusDto(), { status }));
      expect(errors).toHaveLength(0);
    },
  );

  it.each(['active', 'suspended'])(
    'accepts client status %s used by the admin workflow',
    async status => {
      const errors = await validate(Object.assign(new AdminStatusDto(), { status }));
      expect(errors).toHaveLength(0);
    },
  );

  it.each(['pending', 'random', '', null])(
    'rejects unsupported client status %p',
    async status => {
      const errors = await validate(Object.assign(new AdminStatusDto(), { status }));
      expect(errors.some(error => error.property === 'status')).toBe(true);
    },
  );

  it.each(['pending', 'random', '', null])(
    'rejects unsupported driver status %p',
    async status => {
      const errors = await validate(Object.assign(new DriverStatusDto(), { status }));
      expect(errors.some(error => error.property === 'status')).toBe(true);
    },
  );

  it('accepts a bounded reason for a driver status action', async () => {
    const errors = await validate(Object.assign(new DriverStatusDto(), {
      status: 'rejected',
      reason: 'Document review',
    }));
    expect(errors).toHaveLength(0);
  });

  it('accepts a bounded reason for a client status action', async () => {
    const errors = await validate(Object.assign(new AdminStatusDto(), {
      status: 'suspended',
      reason: 'Policy review',
    }));
    expect(errors).toHaveLength(0);
  });

  it('rejects an overlong reason for a driver toggle action', async () => {
    const errors = await validate(Object.assign(new DriverToggleStatusDto(), {
      action: 'deactivate',
      reason: 'x'.repeat(501),
    }));
    expect(errors.some(error => error.property === 'reason')).toBe(true);
  });

  it.each(['car', 'moto', 'truck'])('accepts driver vehicle category %s', async vehicle_category => {
    const errors = await validate(Object.assign(new DriverVehicleCategoryDto(), { vehicle_category }));
    expect(errors).toHaveLength(0);
  });

  it('rejects an unknown driver vehicle category', async () => {
    const errors = await validate(Object.assign(new DriverVehicleCategoryDto(), { vehicle_category: 'spaceship' }));
    expect(errors.some(error => error.property === 'vehicle_category')).toBe(true);
  });
});
