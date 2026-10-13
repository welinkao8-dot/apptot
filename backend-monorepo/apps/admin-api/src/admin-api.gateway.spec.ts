import { JwtService } from '@nestjs/jwt';
import { AdminGateway } from './admin-api.gateway';

describe('AdminGateway', () => {
  const jwt = new JwtService({ secret: 'admin-gateway-test-secret', verifyOptions: { algorithms: ['HS256'] } });

  it('disconnects a socket without a verified admin token', async () => {
    const gateway = new (AdminGateway as any)(jwt);
    const client = {
      handshake: { auth: { token: jwt.sign({ sub: 'driver-a', role: 'driver' }) } },
      data: {},
      disconnect: jest.fn(),
      join: jest.fn(),
    };

    await gateway.handleConnection(client);

    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(client.data).not.toHaveProperty('actor');
  });
});
