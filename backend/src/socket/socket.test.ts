import http from 'http';
import jwt from 'jsonwebtoken';
import { initSocket, emitToUser, emitToRole, io } from './index';
import * as redisModule from '../db/redis';

describe('Socket Module', () => {
  let server: http.Server;
  const jwtSecret = 'test-socket-secret-key';

  beforeAll((done) => {
    server = http.createServer();
    server.listen(0, done);
  });

  afterAll((done) => {
    if (io) {
      io.close();
    }
    server.close(done);
  });

  it('initializes socket.io in memory when redis is unavailable', () => {
    jest.spyOn(redisModule, 'isRedisAvailable').mockReturnValue(false);

    const socketServer = initSocket(server, jwtSecret);
    expect(socketServer).toBeDefined();
    expect(io).toBe(socketServer);
  });

  it('initializes socket.io with redis adapter when redis is available', () => {
    const mockDuplicate = jest.fn().mockReturnValue({
      psubscribe: jest.fn(),
      publish: jest.fn(),
      on: jest.fn(),
    });
    jest.spyOn(redisModule, 'isRedisAvailable').mockReturnValue(true);
    jest.spyOn(redisModule, 'getRedisClient').mockReturnValue({
      duplicate: mockDuplicate,
    } as any);

    const socketServer = initSocket(server, jwtSecret);
    expect(socketServer).toBeDefined();
    expect(mockDuplicate).toHaveBeenCalled();
  });

  it('handles redis adapter creation failure gracefully', () => {
    jest.spyOn(redisModule, 'isRedisAvailable').mockReturnValue(true);
    jest.spyOn(redisModule, 'getRedisClient').mockImplementation(() => {
      throw new Error('Redis adapter error');
    });

    const socketServer = initSocket(server, jwtSecret);
    expect(socketServer).toBeDefined();
  });

  it('emits to user and role rooms safely', () => {
    initSocket(server, jwtSecret);

    expect(() => emitToUser('user123', 'test:event', { foo: 'bar' })).not.toThrow();
    expect(() => emitToRole('doctor', 'test:event', { foo: 'bar' })).not.toThrow();
  });

  it('authenticates socket handshake middleware properly', (done) => {
    initSocket(server, jwtSecret);

    const middlewareFn = (io as any).sockets?._fns?.[0];
    expect(typeof middlewareFn).toBe('function');

    // Test missing token
    const mockSocketNoToken = {
      handshake: { auth: {} },
      data: {},
    } as any;

    middlewareFn(mockSocketNoToken, (err: any) => {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe('Authentication required');

      // Test invalid token
      const mockSocketBadToken = {
        handshake: { auth: { token: 'invalid-token' } },
        data: {},
      } as any;

      middlewareFn(mockSocketBadToken, (err2: any) => {
        expect(err2).toBeInstanceOf(Error);
        expect(err2.message).toBe('Invalid token');

        // Test valid token
        const validToken = jwt.sign({ _id: 'u-123', role: 'doctor' }, jwtSecret);
        const mockSocketValid = {
          handshake: { auth: { token: validToken } },
          data: {},
        } as any;

        middlewareFn(mockSocketValid, (err3: any) => {
          expect(err3).toBeUndefined();
          expect(mockSocketValid.data.user._id).toBe('u-123');
          expect(mockSocketValid.data.user.role).toBe('doctor');
          done();
        });
      });
    });
  });

  it('handles connection and disconnect events', () => {
    initSocket(server, jwtSecret);

    let disconnectCallback: ((reason: string) => void) | undefined;
    const joinMock = jest.fn().mockResolvedValue(undefined);
    const mockSocket = {
      data: { user: { _id: 'user-abc', role: 'nurse' } },
      join: joinMock,
      on: jest.fn().mockImplementation((event: string, cb: any) => {
        if (event === 'disconnect') {
          disconnectCallback = cb;
        }
      }),
    };

    // Find and trigger connection listener registered on io or io.of('/')
    const connListener = (io.listeners('connection')[0] || io.of('/').listeners('connection')[0]) as (s: any) => void;
    expect(typeof connListener).toBe('function');
    connListener(mockSocket);

    expect(joinMock).toHaveBeenCalledWith('user:user-abc');
    expect(joinMock).toHaveBeenCalledWith('role:nurse');
    expect(disconnectCallback).toBeDefined();

    if (disconnectCallback) {
      disconnectCallback('client namespace disconnect');
    }
  });
});
