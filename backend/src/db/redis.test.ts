import { isRedisAvailable, getRedisClient, connectRedis, disconnectRedis } from './redis';
import { env } from '../config/env';

// Mock ioredis
const mockQuit = jest.fn().mockResolvedValue('OK');
const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockOn = jest.fn();

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    connect: mockConnect,
    quit: mockQuit,
    on: mockOn,
    duplicate: jest.fn().mockReturnThis(),
  }));
});

describe('Redis DB Module', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await disconnectRedis();
  });

  afterAll(async () => {
    await disconnectRedis();
  });

  it('reports isRedisAvailable as false initially', () => {
    expect(isRedisAvailable()).toBe(false);
  });

  it('throws error when getRedisClient is called while disconnected', () => {
    expect(() => getRedisClient()).toThrow('Redis not initialized or unavailable');
  });

  it('returns null when REDIS_ENABLED is false', async () => {
    const orig = env.REDIS_ENABLED;
    (env as { REDIS_ENABLED: boolean }).REDIS_ENABLED = false;

    const client = await connectRedis();
    expect(client).toBeNull();
    expect(isRedisAvailable()).toBe(false);

    (env as { REDIS_ENABLED: boolean }).REDIS_ENABLED = orig;
  });

  it('connects to redis successfully when REDIS_ENABLED is true', async () => {
    const orig = env.REDIS_ENABLED;
    (env as { REDIS_ENABLED: boolean }).REDIS_ENABLED = true;

    const client = await connectRedis('redis://localhost:6379');
    expect(client).not.toBeNull();
    expect(isRedisAvailable()).toBe(true);
    expect(getRedisClient()).toBe(client);

    // Test event callbacks registered on client
    const errorCallback = mockOn.mock.calls.find(call => call[0] === 'error')?.[1];
    const readyCallback = mockOn.mock.calls.find(call => call[0] === 'ready')?.[1];
    const reconnectCallback = mockOn.mock.calls.find(call => call[0] === 'reconnecting')?.[1];

    if (errorCallback) errorCallback(new Error('Test redis error'));
    expect(isRedisAvailable()).toBe(false);

    if (readyCallback) readyCallback();
    expect(isRedisAvailable()).toBe(true);

    if (reconnectCallback) reconnectCallback();

    await disconnectRedis();
    expect(isRedisAvailable()).toBe(false);

    (env as { REDIS_ENABLED: boolean }).REDIS_ENABLED = orig;
  });

  it('handles connect failure gracefully and falls back', async () => {
    const orig = env.REDIS_ENABLED;
    (env as { REDIS_ENABLED: boolean }).REDIS_ENABLED = true;

    mockConnect.mockRejectedValueOnce(new Error('Connection refused'));

    const client = await connectRedis('redis://localhost:6379');
    expect(client).toBeNull();
    expect(isRedisAvailable()).toBe(false);

    (env as { REDIS_ENABLED: boolean }).REDIS_ENABLED = orig;
  });

  it('disconnectRedis ignores quit rejection safely', async () => {
    const orig = env.REDIS_ENABLED;
    (env as { REDIS_ENABLED: boolean }).REDIS_ENABLED = true;

    await connectRedis('redis://localhost:6379');
    mockQuit.mockRejectedValueOnce(new Error('Quit error'));

    await expect(disconnectRedis()).resolves.not.toThrow();
    expect(isRedisAvailable()).toBe(false);

    (env as { REDIS_ENABLED: boolean }).REDIS_ENABLED = orig;
  });
});
