/**
 * @jest-environment jsdom
 */
import { authApi, tasksApi } from '../lib/api';

// global.fetch をモックする
global.fetch = jest.fn();

describe('API Client Tests', () => {
  beforeEach(() => {
    fetch.mockClear();
    // localStorage のモック
    Storage.prototype.getItem = jest.fn();
    Storage.prototype.setItem = jest.fn();
  });

  test('authApi.login calls fetch with correct URL and data', async () => {
    const mockUser = { id: 1, name: 'Parent', role: 'parent' };
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ user: mockUser, message: 'success' }),
    });

    const result = await authApi.login({ user_id: 1, pin: '1234' });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/login'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ user_id: 1, pin: '1234' }),
      })
    );
    expect(result.user.name).toBe('Parent');
  });

  test('authApi.login throws error on failed response', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ detail: 'Unauthorized' }),
    });

    await expect(authApi.login(1, 'wrong')).rejects.toThrow('Unauthorized');
  });

  test('tasksApi.complete calls fetch with correct task_id', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 10, status: 'completed' }),
    });

    await tasksApi.complete(10);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/tasks/10/complete'),
      expect.objectContaining({ method: 'POST' })
    );
  });
});
