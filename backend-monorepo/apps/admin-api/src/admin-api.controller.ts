import { Controller, Get, Post, Param, Body, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { AdminApiService } from './admin-api.service';

@Controller('admin')
export class AdminApiController {
  constructor(private readonly adminApiService: AdminApiService) { }

  @Get('stats')
  getStats() {
    return this.adminApiService.getDashboardStats();
  }

  @Get('drivers')
  getAllDrivers() {
    return this.adminApiService.getAllDrivers();
  }

  @Get('clients')
  getAllClients() {
    return this.adminApiService.getAllClients();
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

  @Post('drivers/:id/approve')
  approveDriver(@Param('id') id: string) {
    return this.adminApiService.approveDriver(id);
  }

  @Post('drivers/:id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.adminApiService.updateDriverStatus(id, status);
  }

  @Get('configs')
  getConfigs() {
    return this.adminApiService.getServiceConfigs();
  }

  @Post('services')
  createService(@Body() data: any) {
    return this.adminApiService.createServiceConfig(data);
  }

  @Post('services/:id')
  updateService(@Param('id') id: string, @Body() data: any) {
    return this.adminApiService.updateServiceConfig(Number(id), data);
  }

  @Post('services/:id/delete') // or 
  deleteService(@Param('id') id: string) {
    return this.adminApiService.deleteServiceConfig(Number(id));
  }

  @Post('configs/:id')
  updateConfig(@Param('id') id: string, @Body() data: any) {
    return this.adminApiService.updateServiceConfig(Number(id), data);
  }

  @Get('trips')
  getAllTrips() {
    return this.adminApiService.getAllTrips();
  }

  @Get('logs')
  getLogs() {
    return this.adminApiService.getAuditLogs();
  }

  @Get('analytics')
  getAnalytics() {
    return this.adminApiService.getAnalytics();
  }

  @Post('drivers/:id/toggle-status')
  toggleDriverStatus(@Param('id') id: string, @Body() body: { action: 'activate' | 'deactivate' }) {
    const newStatus = body.action === 'activate' ? 'active' : 'suspended';
    return this.adminApiService.updateDriverStatus(id, newStatus);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const uploadPath = join(__dirname, '..', '..', '..', 'uploads', 'services');
        if (!existsSync(uploadPath)) {
          mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
      },
    }),
  }))
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    const baseUrl = process.env.ADMIN_API_URL || 'http://localhost:3000';
    return {
      url: `${baseUrl}/uploads/services/${file.filename}`,
    };
  }
}
