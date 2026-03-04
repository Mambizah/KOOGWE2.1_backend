import { PaymentMethod, VehicleType } from '@prisma/client';
export declare class CreateRideDto {
    originLat: number;
    originLng: number;
    destLat: number;
    destLng: number;
    price: number;
    distance?: number;
    duration?: number;
    originAddress?: string;
    destAddress?: string;
    vehicleType?: VehicleType;
    paymentMethod?: PaymentMethod;
}
