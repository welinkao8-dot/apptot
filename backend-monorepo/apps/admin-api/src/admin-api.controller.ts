import { BadRequestException, Controller, Get, Post, Param, Body, Query, UseGuards, UseInterceptors, UploadedFile, UsePipes, ValidationPipe } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { join } from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import { AdminApiService } from './admin-api.service';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '@app/auth';
import type { AuthUser } from '@app/auth';
import { CreateServiceConfigDto, UpdateServiceConfigDto } from './service-config.dto';
import { AdminStatusDto, DriverStatusDto, DriverToggleStatusDto, DriverVehicleCategoryDto } from './admin-status.dto';
import { getSupportedRasterImageType } from './image-upload';

const strictStatusPipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminApiController {
  constructor(private readonly adminApiService: AdminApiService) { }

  @Get('stats')
  getStats() {
    return this.adminApiService.getDashboardStats();
  }

  @Get('drivers')
  getAllDrivers(@Query() query: { page?: string; limit?: string; status?: string; search?: string }) {
    const parsePositiveInteger = (value: string | undefined, fallback: number, name: string, max: number) => {
      if (value === undefined) return fallback;
      if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new BadRequestException(`${name} deve ser um número inteiro positivo.`);
      const parsed = Number(value);
      if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) throw new BadRequestException(`${name} deve estar entre 1 e ${max}.`);
      return parsed;
    };
    const page = parsePositiveInteger(query.page, 1, 'page', 100_000);
    const limit = parsePositiveInteger(query.limit, 20, 'limit', 100);
    const statuses = ['all', 'pending', 'active', 'approved', 'rejected', 'suspended'];
    if (query.status !== undefined && (typeof query.status !== 'string' || !statuses.includes(query.status))) {
      throw new BadRequestException('status inválido.');
    }
    if (query.search !== undefined && typeof query.search !== 'string') throw new BadRequestException('search deve ser texto.');
    const search = query.search?.trim() ?? '';
    if (search.length > 120) throw new BadRequestException('search não pode exceder 120 caracteres.');
    return this.adminApiService.getAllDrivers(page, limit, query.status ?? 'all', search);
  }

  @Get('clients')
  getAllClients(@Query() query: { page?: string; limit?: string; search?: string }) {
    const parsePositiveInteger = (value: string | undefined, fallback: number, name: string, max: number) => {
      if (value === undefined) return fallback;
      if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new BadRequestException(`${name} deve ser um número inteiro positivo.`);
      const parsed = Number(value);
      if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) throw new BadRequestException(`${name} deve estar entre 1 e ${max}.`);
      return parsed;
    };
    const page = parsePositiveInteger(query.page, 1, 'page', 100_000);
    const limit = parsePositiveInteger(query.limit, 20, 'limit', 100);
    if (query.search !== undefined && typeof query.search !== 'string') throw new BadRequestException('search deve ser texto.');
    const search = query.search?.trim() ?? '';
    if (search.length > 120) throw new BadRequestException('search não pode exceder 120 caracteres.');
    return this.adminApiService.getAllClients(page, limit, search);
  }

  @Get('clients/:id/trips')
  getClientTrips(@Param('id') id: string, @Query() query: { page?: string; limit?: string }) {
    const page = this.parsePaginationValue(query.page, 1, 'page', 100_000);
    const limit = this.parsePaginationValue(query.limit, 20, 'limit', 100);
    return this.adminApiService.getClientTrips(id, page, limit);
  }

  @Get('drivers/:id/trips')
  getDriverTrips(@Param('id') id: string, @Query() query: { page?: string; limit?: string }) {
    const page = this.parsePaginationValue(query.page, 1, 'page', 100_000);
    const limit = this.parsePaginationValue(query.limit, 20, 'limit', 100);
    return this.adminApiService.getDriverTrips(id, page, limit);
  }

  private parsePaginationValue(value: string | undefined, fallback: number, name: string, max: number) {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new BadRequestException(`${name} deve ser um número inteiro positivo.`);
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) throw new BadRequestException(`${name} deve estar entre 1 e ${max}.`);
    return parsed;
  }

  @Get('drivers/pending')
  getPendingDrivers() {
    return this.adminApiService.getPendingDrivers();
  }

  @Get('drivers/locations')
  getOnlineDrivers() {
    return this.adminApiService.getOnlineDriversLocations();
  }

  @Get('drivers/:id')
  getDriver(@Param('id') id: string) {
    return this.adminApiService.getDriverById(id);
  }

  @Get('drivers/:id/documents')
  getDriverDocuments(@Param('id') id: string) {
    return this.adminApiService.getDriverDocuments(id);
  }

  @Post('drivers/:id/vehicle-category')
  @UsePipes(strictStatusPipe)
  updateDriverVehicleCategory(@Param('id') id: string, @Body() body: DriverVehicleCategoryDto, @CurrentUser() admin: AuthUser) {
    return this.adminApiService.updateDriverVehicleCategory(id, body.vehicle_category, admin.sub);
  }

  @Post('drivers/:id/approve')
  approveDriver(@Param('id') id: string, @CurrentUser() admin: AuthUser) {
    return this.adminApiService.approveDriver(id, admin.sub);
  }

  @Post('drivers/:id/status')
  @UsePipes(strictStatusPipe)
  updateStatus(@Param('id') id: string, @Body() body: DriverStatusDto, @CurrentUser() admin: AuthUser) {
    return this.adminApiService.updateDriverStatus(id, body.status === 'approved' ? 'active' : body.status, admin.sub, body.reason);
  }

  @Get('configs')
  getConfigs() {
    return this.adminApiService.getServiceConfigs();
  }

  @Post('services')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  createService(@Body() data: CreateServiceConfigDto, @CurrentUser() admin: AuthUser) {
    return this.adminApiService.createServiceConfig(data, admin.sub);
  }

  @Post('services/:id')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  updateService(@Param('id') id: string, @Body() data: UpdateServiceConfigDto, @CurrentUser() admin: AuthUser) {
    return this.adminApiService.updateServiceConfig(Number(id), data, admin.sub);
  }

  @Post('services/:id/delete') // or 
  deleteService(@Param('id') id: string, @CurrentUser() admin: AuthUser) {
    return this.adminApiService.deleteServiceConfig(Number(id), admin.sub);
  }

  @Post('configs/:id')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  updateConfig(@Param('id') id: string, @Body() data: UpdateServiceConfigDto, @CurrentUser() admin: AuthUser) {
    return this.adminApiService.updateServiceConfig(Number(id), data, admin.sub);
  }

  @Get('trips')
  getAllTrips(@Query() query: { page?: string; limit?: string; status?: string; search?: string }) {
    const parsePositiveInteger = (value: string | undefined, fallback: number, name: string, max = Number.MAX_SAFE_INTEGER) => {
      if (value === undefined) return fallback;
      if (!/^\d+$/.test(value)) throw new BadRequestException(`${name} deve ser um número inteiro positivo.`);
      const parsed = Number(value);
      if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) {
        throw new BadRequestException(`${name} deve estar entre 1 e ${max}.`);
      }
      return parsed;
    };
    const page = parsePositiveInteger(query.page, 1, 'page', 100_000);
    const limit = parsePositiveInteger(query.limit, 20, 'limit', 100);
    if (query.status !== undefined && (typeof query.status !== 'string' || !['all', 'live', 'completed', 'cancelled'].includes(query.status))) {
      throw new BadRequestException('status inválido.');
    }
    if (query.search !== undefined && typeof query.search !== 'string') {
      throw new BadRequestException('search deve ser texto.');
    }
    const search = query.search?.trim() ?? '';
    if (search.length > 120) throw new BadRequestException('search não pode exceder 120 caracteres.');
    return this.adminApiService.getAllTrips(page, limit, query.status ?? 'all', search);
  }

  @Get('trips/:id')
  getTripById(@Param('id') id: string) {
    return this.adminApiService.getTripById(id);
  }

  @Get('invoices')
  getAllInvoices(@Query() query: { page?: string; limit?: string; type?: string; search?: string }) {
    const page = this.parsePaginationValue(query.page, 1, 'page', 100_000);
    const limit = this.parsePaginationValue(query.limit, 20, 'limit', 100);
    if (query.type !== undefined && typeof query.type !== 'string') throw new BadRequestException('type deve ser texto.');
    const type = query.type?.trim() || 'all';
    if (type.length > 80) throw new BadRequestException('type não pode exceder 80 caracteres.');
    if (query.search !== undefined && typeof query.search !== 'string') throw new BadRequestException('search deve ser texto.');
    const search = query.search?.trim() ?? '';
    if (search.length > 120) throw new BadRequestException('search não pode exceder 120 caracteres.');
    return this.adminApiService.getAllInvoices(page, limit, type, search);
  }

  @Get('payments')
  getAllPayments(@Query() query: { page?: string; limit?: string; status?: string; search?: string }) {
    const page = this.parsePaginationValue(query.page, 1, 'page', 100_000);
    const limit = this.parsePaginationValue(query.limit, 20, 'limit', 100);
    if (query.status !== undefined && (typeof query.status !== 'string' || !['all', 'pending', 'confirmed'].includes(query.status))) {
      throw new BadRequestException('status inválido.');
    }
    if (query.search !== undefined && typeof query.search !== 'string') throw new BadRequestException('search deve ser texto.');
    const search = query.search?.trim() ?? '';
    if (search.length > 120) throw new BadRequestException('search não pode exceder 120 caracteres.');
    return this.adminApiService.getAllPayments(page, limit, query.status ?? 'all', search);
  }

  @Get('invoices/user/:userId')
  getInvoicesByUser(@Param('userId') userId: string) {
    return this.adminApiService.getInvoicesByUser(userId);
  }

  @Get('settings')
  getAppSettings() {
    return this.adminApiService.getAppSettings();
  }

  @Get('logs')
  getLogs(@Query() query: { page?: string; limit?: string; action?: string; target?: string; search?: string }) {
    const page = this.parsePaginationValue(query.page, 1, 'page', 100_000);
    const limit = this.parsePaginationValue(query.limit, 20, 'limit', 100);
    const parseFilter = (value: string | undefined, name: string, maxLength: number) => {
      if (value === undefined) return undefined;
      if (typeof value !== 'string') throw new BadRequestException(`${name} deve ser texto.`);
      if (value.length > maxLength) throw new BadRequestException(`${name} inválido.`);
      const trimmed = value.trim();
      return trimmed || undefined;
    };
    const action = parseFilter(query.action, 'action', 255);
    const target = parseFilter(query.target, 'target', 255);
    const search = parseFilter(query.search, 'search', 120);
    return this.adminApiService.getAuditLogs(page, limit, { action, target, search });
  }

  @Get('analytics')
  getAnalytics() {
    return this.adminApiService.getAnalytics();
  }

  @Post('drivers/:id/toggle-status')
  @UsePipes(strictStatusPipe)
  toggleDriverStatus(@Param('id') id: string, @Body() body: DriverToggleStatusDto, @CurrentUser() admin: AuthUser) {
    const newStatus = body.action === 'activate' ? 'active' : 'suspended';
    return this.adminApiService.updateDriverStatus(id, newStatus, admin.sub, body.reason);
  }

  @Post('clients/:id/status')
  @UsePipes(strictStatusPipe)
  updateClientStatus(@Param('id') id: string, @Body() body: AdminStatusDto, @CurrentUser() admin: AuthUser) {
    return this.adminApiService.updateClientStatus(id, body.status, admin.sub, body.reason);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
        cb(new BadRequestException('Envie uma imagem JPEG, PNG ou WebP.'), false);
      } else {
        cb(null, true);
      }
    },
  }))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file?.buffer) throw new BadRequestException('Selecione uma imagem para enviar.');
    const type = getSupportedRasterImageType(file.buffer);
    if (!type) throw new BadRequestException('O conteúdo não é uma imagem JPEG, PNG ou WebP válida.');

    const uploadPath = join(process.cwd(), 'uploads', 'services');
    await mkdir(uploadPath, { recursive: true });
    const filename = `${randomUUID()}.${type === 'jpeg' ? 'jpg' : type}`;
    await writeFile(join(uploadPath, filename), file.buffer, { flag: 'wx', mode: 0o644 });
    const baseUrl = process.env.ADMIN_API_URL || 'http://localhost:3000';
    return {
      url: `${baseUrl}/uploads/services/${filename}`,
    };
  }
}
