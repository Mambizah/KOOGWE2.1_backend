import { IsNumber, IsNotEmpty, IsPositive, IsEnum, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod, VehicleType } from '@prisma/client';

export class CreateRideDto {
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  originLat: number;

  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  originLng: number;

  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  destLat: number;

  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  destLng: number;

  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  price: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  distance?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  duration?: number;

  @IsOptional()
  @IsString()
  originAddress?: string;

  @IsOptional()
  @IsString()
  destAddress?: string;

  // ✅ FIX BUG 2 : vehicleType accepté et validé
  @IsEnum(VehicleType)
  @IsOptional()
  vehicleType?: VehicleType;

  @IsEnum(PaymentMethod)
  @IsOptional()
  paymentMethod?: PaymentMethod;
}
