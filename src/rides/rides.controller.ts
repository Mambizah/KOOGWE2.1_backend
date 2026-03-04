import { Controller, Post, Get, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { RidesService } from './rides.service';
import { AuthGuard } from '../auth/auth.guard';
import { RideStatus } from '@prisma/client';

@Controller('rides')
@UseGuards(AuthGuard)
export class RidesController {
  constructor(private ridesService: RidesService) {}

  @Post()
  create(@Body() dto: any, @Request() req: any) {
    return this.ridesService.create(dto, req.user.sub);
  }

  @Get('history')
  getHistory(@Request() req: any) {
    return this.ridesService.getHistory(req.user.sub, req.user.role);
  }

  @Get('driver/stats')
  getDriverStats(@Request() req: any) {
    return this.ridesService.getDriverStats(req.user.sub);
  }

  @Get('active')
  getActiveCourses() {
    return this.ridesService.getActiveCourses();
  }

  @Post('estimate')
  estimatePrice(@Body() dto: {
    distanceKm: number;
    durationMin: number;
    vehicleType?: string;
    zone?: string;
    horaire?: string;
    trafic?: string;
    meteo?: string;
    demande?: string;
  }) {
    return this.ridesService.estimatePrice(dto);
  }

  @Post(':id/accept')
  acceptRide(@Param('id') id: string, @Request() req: any) {
    return this.ridesService.acceptRide(id, req.user.sub);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: { status: RideStatus }, @Request() req: any) {
    return this.ridesService.updateStatus(id, req.user.sub, dto.status);
  }

  @Post('scheduled')
  createScheduled(@Body() dto: any, @Request() req: any) {
    return this.ridesService.createScheduledRide(req.user.sub, dto);
  }

  @Post(':id/share')
  generateShare(@Param('id') id: string, @Request() req: any) {
    return this.ridesService.generateShareToken(id, req.user.sub);
  }

  @Post('panic')
  triggerPanic(@Body() dto: { rideId?: string; lat: number; lng: number }, @Request() req: any) {
    return this.ridesService.triggerPanic(req.user.sub, dto.rideId ?? null, dto.lat, dto.lng);
  }

  @Post('favorites/add')
  addFavorite(@Body() dto: { driverId: string }, @Request() req: any) {
    return this.ridesService.addFavoriteDriver(req.user.sub, dto.driverId);
  }

  @Post('favorites/remove')
  removeFavorite(@Body() dto: { driverId: string }, @Request() req: any) {
    return this.ridesService.removeFavoriteDriver(req.user.sub, dto.driverId);
  }

  @Get('favorites')
  getFavorites(@Request() req: any) {
    return this.ridesService.getFavoriteDrivers(req.user.sub);
  }

  @Get('track/:token')
  trackByToken(@Param('token') token: string) {
    return this.ridesService.getRideByShareToken(token);
  }

  @Patch(':id/cancel')
  cancelRide(@Param('id') id: string, @Request() req: any) {
    return this.ridesService.cancelRide(id, req.user.sub, req.user.role);
  }

  @Post(':id/rate')
  rateRide(
    @Param('id') id: string,
    @Body() dto: { rating: number; comment?: string },
    @Request() req: any,
  ) {
    return this.ridesService.rateRide(id, req.user.sub, req.user.role, dto.rating, dto.comment);
  }
}