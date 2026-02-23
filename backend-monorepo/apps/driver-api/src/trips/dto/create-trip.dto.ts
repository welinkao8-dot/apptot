export class CreateTripDto {
    clientId: string;
    userName?: string;
    originAddress: string;
    destAddress: string;
    price: string | number;
    category?: string; // ride or delivery
    serviceConfigId?: number;
    deliveryInfo?: any; // JSON object
    originLat?: number;
    originLng?: number;
    destLat?: number;
    destLng?: number;
}
