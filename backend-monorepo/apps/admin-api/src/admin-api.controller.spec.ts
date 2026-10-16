import { AdminApiController } from './admin-api.controller';
import { Test, TestingModule } from '@nestjs/testing';
import { AdminApiService } from './admin-api.service';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard, RolesGuard } from '@app/auth';

const ADMIN_ROLES_KEY = 'auth:roles';

describe('AdminApiController', () => {
  let adminApiController: AdminApiController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AdminApiController],
      providers: [{ provide: AdminApiService, useValue: {} }],
    }).compile();

    adminApiController = app.get<AdminApiController>(AdminApiController);
  });

  it('is instantiated', () => {
    expect(adminApiController).toBeDefined();
  });

  it('validates and forwards page and limit for admin trips', () => {
    const getAllTrips = jest.fn();
    const controller = new AdminApiController({ getAllTrips } as never);
    controller.getAllTrips({ page: '3', limit: '40', status: 'live', search: ' Ana ' });
    expect(getAllTrips).toHaveBeenCalledWith(3, 40, 'live', 'Ana');
  });

  it('validates and forwards pagination and search for admin clients', () => {
    const getAllClients = jest.fn();
    const controller = new AdminApiController({ getAllClients } as never);
    controller.getAllClients({ page: '2', limit: '30', search: ' Ana ' });
    expect(getAllClients).toHaveBeenCalledWith(2, 30, 'Ana');
  });

  it('validates and forwards pagination, status and search for admin drivers', () => {
    const getAllDrivers = jest.fn();
    const controller = new AdminApiController({ getAllDrivers } as never);
    controller.getAllDrivers({ page: '2', limit: '30', status: 'active', search: ' Ana ' });
    expect(getAllDrivers).toHaveBeenCalledWith(2, 30, 'active', 'Ana');
  });

  it('validates and forwards invoice pagination, type and search', () => {
    const getAllInvoices = jest.fn();
    const controller = new AdminApiController({ getAllInvoices } as never);
    controller.getAllInvoices({ page: '3', limit: '15', type: 'ride', search: ' Ana ' });
    expect(getAllInvoices).toHaveBeenCalledWith(3, 15, 'ride', 'Ana');
  });

  it('validates and forwards payment pagination, status and search', () => {
    const getAllPayments = jest.fn();
    const controller = new AdminApiController({ getAllPayments } as never);
    controller.getAllPayments({ page: '2', limit: '25', status: 'pending', search: 'trip-a' });
    expect(getAllPayments).toHaveBeenCalledWith(2, 25, 'pending', 'trip-a');
  });

  it('validates and forwards audit pagination and schema-backed filters', () => {
    const getAuditLogs = jest.fn();
    const controller = new AdminApiController({ getAuditLogs } as never);

    controller.getLogs({ page: '2', limit: '30', action: ' UPDATE_STATUS_ACTIVE ', target: ' driver ', search: ' Ana ' });

    expect(getAuditLogs).toHaveBeenCalledWith(2, 30, { action: 'UPDATE_STATUS_ACTIVE', target: 'driver', search: 'Ana' });
  });

  it.each([
    { page: '0' }, { page: '100001' }, { limit: '101' }, { action: ['a', 'b'] as unknown as string },
    { search: 'x'.repeat(121) }, { search: ['a', 'b'] as unknown as string },
  ])('rejects invalid audit query parameters', query => {
    const controller = new AdminApiController({ getAuditLogs: jest.fn() } as never);
    expect(() => controller.getLogs(query)).toThrow();
  });

  it('treats empty audit filters as omitted', () => {
    const getAuditLogs = jest.fn();
    const controller = new AdminApiController({ getAuditLogs } as never);
    controller.getLogs({ action: '', target: '  ', search: '' });
    expect(getAuditLogs).toHaveBeenCalledWith(1, 20, { action: undefined, target: undefined, search: undefined });
  });

  it.each([
    ['invoice', { page: '0' }], ['invoice', { limit: '101' }], ['invoice', { search: 'x'.repeat(121) }],
    ['invoice', { type: ['ride', 'delivery'] as unknown as string }],
    ['payment', { page: '0' }], ['payment', { limit: '101' }], ['payment', { search: ['a', 'b'] as unknown as string }],
    ['payment', { status: ['pending', 'confirmed'] as unknown as string }], ['payment', { status: 'unknown' }],
  ])('rejects invalid %s query parameters', (kind, query) => {
    const controller = new AdminApiController({ getAllInvoices: jest.fn(), getAllPayments: jest.fn() } as never);
    const invoke = kind === 'invoice'
      ? () => controller.getAllInvoices(query)
      : () => controller.getAllPayments(query);
    expect(invoke).toThrow();
  });

  it.each([
    { page: '0' }, { limit: '101' }, { search: 'x'.repeat(121) },
    { search: ['a', 'b'] as unknown as string }, { status: ['active', 'pending'] as unknown as string },
    { status: 'unknown' },
  ])('rejects invalid driver list query parameters', query => {
    const controller = new AdminApiController({ getAllDrivers: jest.fn() } as never);
    expect(() => controller.getAllDrivers(query)).toThrow();
  });

  it('validates pagination for owner-scoped client and driver trip history', () => {
    const getClientTrips = jest.fn();
    const getDriverTrips = jest.fn();
    const controller = new AdminApiController({ getClientTrips, getDriverTrips } as never);
    controller.getClientTrips('client-a', { page: '2', limit: '10' });
    controller.getDriverTrips('driver-a', { page: '3', limit: '25' });
    expect(getClientTrips).toHaveBeenCalledWith('client-a', 2, 10);
    expect(getDriverTrips).toHaveBeenCalledWith('driver-a', 3, 25);
  });

  it.each([{ page: '0' }, { limit: '101' }, { limit: '1.5' }])('rejects invalid owner-scoped trip pagination', query => {
    const controller = new AdminApiController({ getClientTrips: jest.fn() } as never);
    expect(() => controller.getClientTrips('client-a', query)).toThrow();
  });

  it.each([{ page: '1', limit: '20', search: ['a', 'b'] as unknown as string }, { page: '1', limit: '20', search: 'x'.repeat(121) }])('rejects repeated or oversized client search', query => {
    const controller = new AdminApiController({ getAllClients: jest.fn() } as never);
    expect(() => controller.getAllClients(query)).toThrow();
  });

  it.each([{ page: '0', limit: '20' }, { page: '1', limit: '101' }, { page: 'abc', limit: '20' }])('rejects invalid trips query $page/$limit', ({ page, limit }) => {
    const controller = new AdminApiController({ getAllTrips: jest.fn() } as never);
    expect(() => controller.getAllTrips({ page, limit })).toThrow();
  });

  it.each([
    { page: '100001' },
    { search: 'x'.repeat(121) },
    { search: ['one', 'two'] as unknown as string },
    { status: '' },
    { status: ['all', 'live'] as unknown as string },
  ])('rejects pathological or repeated trip search parameters', query => {
    const controller = new AdminApiController({ getAllTrips: jest.fn() } as never);
    expect(() => controller.getAllTrips(query)).toThrow();
  });

  it('passes the authenticated administrator to service deletion', () => {
    const deleteServiceConfig = jest.fn();
    const controller = new AdminApiController({ deleteServiceConfig } as never);

    controller.deleteService('7', { sub: 'admin-profile-id' } as never);

    expect(deleteServiceConfig).toHaveBeenCalledWith(7, 'admin-profile-id');
  });

  it('passes the admin actor and requested vehicle category to the classification service', () => {
    const updateDriverVehicleCategory = jest.fn();
    const controller = new AdminApiController({ updateDriverVehicleCategory } as never);

    controller.updateDriverVehicleCategory('driver-a', { vehicle_category: 'moto' }, { sub: 'admin-a' } as never);

    expect(updateDriverVehicleCategory).toHaveBeenCalledWith('driver-a', 'moto', 'admin-a');
  });

  it('protects sensitive admin operations with JWT authentication and the admin role', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminApiController)).toEqual([JwtAuthGuard, RolesGuard]);
    expect(Reflect.getMetadata(ADMIN_ROLES_KEY, AdminApiController)).toEqual(['admin']);
  });

  it('maps the approved request value to the active driver status and passes the authenticated actor', () => {
    const updateDriverStatus = jest.fn();
    const controller = new AdminApiController({
      updateDriverStatus,
    } as never);

    controller.updateStatus('driver-a', { status: 'approved' }, { sub: 'admin-profile-id' } as never);

    expect(updateDriverStatus).toHaveBeenCalledWith('driver-a', 'active', 'admin-profile-id', undefined);
  });

  it('passes a driver status reason through to the audited mutation', () => {
    const updateDriverStatus = jest.fn();
    const controller = new AdminApiController({ updateDriverStatus } as never);

    controller.updateStatus('driver-a', { status: 'rejected', reason: 'Document review' } as never, { sub: 'admin-profile-id' } as never);

    expect(updateDriverStatus).toHaveBeenCalledWith('driver-a', 'rejected', 'admin-profile-id', 'Document review');
  });

  it('passes the authenticated actor to client status mutations', () => {
    const updateClientStatus = jest.fn();
    const controller = new AdminApiController({
      updateClientStatus,
    } as never);

    controller.updateClientStatus('client-a', { status: 'suspended' }, { sub: 'admin-profile-id' } as never);

    expect(updateClientStatus).toHaveBeenCalledWith('client-a', 'suspended', 'admin-profile-id', undefined);
  });

  it('passes a client status reason through to the audited mutation', () => {
    const updateClientStatus = jest.fn();
    const controller = new AdminApiController({ updateClientStatus } as never);

    controller.updateClientStatus('client-a', { status: 'suspended', reason: 'Policy review' } as never, { sub: 'admin-profile-id' } as never);

    expect(updateClientStatus).toHaveBeenCalledWith('client-a', 'suspended', 'admin-profile-id', 'Policy review');
  });
});
