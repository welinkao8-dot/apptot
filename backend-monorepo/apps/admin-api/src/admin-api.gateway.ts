import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable } from '@nestjs/common';

@Injectable()
@WebSocketGateway({
    cors: {
        origin: '*',
    },
    namespace: 'admin',
})
export class AdminGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    handleConnection(client: Socket) {
        console.log(`Admin client connected: ${client.id}`);
    }

    handleDisconnect(client: Socket) {
        console.log(`Admin client disconnected: ${client.id}`);
    }

    // Method to push updates to all connected admins
    sendToAdmins(event: string, data: any) {
        this.server.emit(event, data);
    }

    @SubscribeMessage('ping')
    handlePing(client: Socket) {
        return { event: 'pong', data: new Date().toISOString() };
    }
}
