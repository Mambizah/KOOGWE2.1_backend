import { VehicleType } from '@prisma/client';
export declare class CreateRideDto {
    originLat: number;
    originLng: number;
    destLat: number;
    destLng: number;
    price: number;
    vehicleType?: VehicleType;
}
