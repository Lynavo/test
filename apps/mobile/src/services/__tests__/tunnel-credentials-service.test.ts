jest.mock('../api', () => ({
  apiGet: jest.fn().mockResolvedValue({
    code: 0,
    data: {
      username: 'user',
      credential: 'secret',
      urls: ['turn:review-api.vividrop.cn:3478?transport=udp'],
    },
  }),
}));

import { apiGet } from '../api';
import { fetchTunnelIceServersJSON } from '../tunnel-credentials-service';

describe('fetchTunnelIceServersJSON', () => {
  it('serializes TURN credentials into ICE server JSON', async () => {
    await expect(fetchTunnelIceServersJSON()).resolves.toBe(
      JSON.stringify([
        {
          urls: ['turn:review-api.vividrop.cn:3478?transport=udp'],
          username: 'user',
          credential: 'secret',
        },
      ]),
    );
    expect(apiGet).toHaveBeenCalledWith('/tunnel/turn-credentials');
  });
});
