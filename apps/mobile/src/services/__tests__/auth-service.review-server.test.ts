jest.mock('../api', () => ({
  apiDelete: jest.fn(),
  apiGet: jest.fn(),
  apiPost: jest.fn(),
  apiPostNoAuth: jest.fn(),
}));

jest.mock('../config', () => ({
  PROD_BASE_URL: 'https://api.vividrop.cn',
  REVIEW_API_BASE_URL: 'https://review-api.vividrop.cn',
  resolveAuthBaseUrlForPhone: jest.fn(() => 'https://review-api.vividrop.cn'),
  setSessionBaseUrl: jest.fn().mockResolvedValue(undefined),
}));

import { apiPostNoAuth } from '../api';
import { setSessionBaseUrl } from '../config';
import { sendSmsCode, smsLogin } from '../auth-service';

describe('auth-service review server routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('sends App Review SMS requests to the review API server', async () => {
    (apiPostNoAuth as jest.Mock).mockResolvedValueOnce({});

    const result = await sendSmsCode('17000000002');

    expect(result.authBaseUrl).toBe('https://review-api.vividrop.cn');
    expect(apiPostNoAuth).toHaveBeenCalledWith(
      '/auth/sms/send',
      { phone: '17000000002' },
      { baseUrlOverride: 'https://review-api.vividrop.cn' },
    );
  });

  test('sends normal SMS requests to the review API server by default', async () => {
    (apiPostNoAuth as jest.Mock).mockResolvedValueOnce({});

    const result = await sendSmsCode('13312341234');

    expect(result.authBaseUrl).toBe('https://review-api.vividrop.cn');
    expect(apiPostNoAuth).toHaveBeenCalledWith(
      '/auth/sms/send',
      { phone: '13312341234' },
      { baseUrlOverride: 'https://review-api.vividrop.cn' },
    );
  });

  test('logs in against the same API server and stores it for the session', async () => {
    (apiPostNoAuth as jest.Mock).mockResolvedValueOnce({
      access_token: 'access-1',
      refresh_token: 'refresh-1',
      is_new_user: false,
      merged: false,
    });

    const result = await smsLogin(
      '17000000002',
      '520813',
      'https://review-api.vividrop.cn',
    );

    expect(result.accessToken).toBe('access-1');
    expect(apiPostNoAuth).toHaveBeenCalledWith(
      '/auth/sms/login',
      { phone: '17000000002', code: '520813' },
      { baseUrlOverride: 'https://review-api.vividrop.cn' },
    );
    expect(setSessionBaseUrl).toHaveBeenCalledWith(
      'https://review-api.vividrop.cn',
    );
  });
});
