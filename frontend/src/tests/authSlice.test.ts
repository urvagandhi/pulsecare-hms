import { describe, it, expect } from 'vitest';
import { authReducer, setCredentials, clearCredentials, updateAccessToken, setLoading, AuthUser } from '../store/authSlice';

describe('Redux Auth Slice', () => {
  const mockUser: AuthUser = {
    _id: 'user_123',
    email: 'doctor@pulsecare.com',
    firstName: 'Vikram',
    lastName: 'Sharma',
    role: 'doctor',
  };

  it('initializes with default unauthenticated state', () => {
    const state = authReducer(undefined, { type: '@@INIT' });
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.isLoading).toBe(true);
  });

  it('handles setCredentials correctly upon login', () => {
    const prevState = { user: null, accessToken: null, isAuthenticated: false, isLoading: true };
    const nextState = authReducer(prevState, setCredentials({ user: mockUser, accessToken: 'jwt_mock_token' }));

    expect(nextState.isAuthenticated).toBe(true);
    expect(nextState.user).toEqual(mockUser);
    expect(nextState.accessToken).toBe('jwt_mock_token');
  });

  it('handles clearCredentials on logout', () => {
    const loggedInState = { user: mockUser, accessToken: 'jwt_mock_token', isAuthenticated: true, isLoading: false };
    const nextState = authReducer(loggedInState, clearCredentials());

    expect(nextState.isAuthenticated).toBe(false);
    expect(nextState.user).toBeNull();
    expect(nextState.accessToken).toBeNull();
  });

  it('updates access token independently on silent refresh', () => {
    const loggedInState = { user: mockUser, accessToken: 'old_token', isAuthenticated: true, isLoading: false };
    const nextState = authReducer(loggedInState, updateAccessToken('new_rotated_token'));

    expect(nextState.accessToken).toBe('new_rotated_token');
    expect(nextState.user).toEqual(mockUser);
    expect(nextState.isAuthenticated).toBe(true);
  });

  it('toggles loading state', () => {
    const state = authReducer(undefined, setLoading(false));
    expect(state.isLoading).toBe(false);
  });
});
