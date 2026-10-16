jest.mock('socket.io-client', () => ({ __esModule: true, default: jest.fn() }));

import io from 'socket.io-client';
import { connectSocket, disconnectSocket } from './socket';

describe('driver socket lifecycle', () => {
  beforeEach(() => {
    disconnectSocket();
    jest.clearAllMocks();
  });

  it('reuses a socket only when the authenticated token is unchanged', () => {
    const firstSocket = { connected: true, disconnect: jest.fn(), on: jest.fn() };
    const secondSocket = { connected: false, disconnect: jest.fn(), on: jest.fn() };
    io.mockReturnValueOnce(firstSocket).mockReturnValueOnce(secondSocket);

    expect(connectSocket('token-a')).toBe(firstSocket);
    expect(connectSocket('token-a')).toBe(firstSocket);
    expect(connectSocket('token-b')).toBe(secondSocket);

    expect(firstSocket.disconnect).toHaveBeenCalledTimes(1);
    expect(io).toHaveBeenCalledTimes(2);
    expect(io.mock.calls[1][1].auth).toEqual({ token: 'token-b' });
  });

  it('disconnects and clears the stored authentication token', () => {
    const socket = { connected: false, disconnect: jest.fn(), on: jest.fn() };
    io.mockReturnValueOnce(socket);
    connectSocket('token-a');

    disconnectSocket();
    const replacement = { connected: false, disconnect: jest.fn(), on: jest.fn() };
    io.mockReturnValueOnce(replacement);
    expect(connectSocket('token-b')).toBe(replacement);
    expect(io).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ auth: { token: 'token-b' } }));
  });
});
