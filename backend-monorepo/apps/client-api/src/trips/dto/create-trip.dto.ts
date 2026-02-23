export class CreateTripDto {
    originAddress: string;
    destAddress: string;
    price: string;
    originLat?: number;
    originLng?: number;
    destLat?: number;
    destLng?: number;
    serviceConfigId?: number;
    category?: string; // ride or delivery
    deliveryInfo?: any; // JSON object
}
