import { apiGet } from './api';

type ICEServerPayload = {
  urls: string[];
  username?: string;
  credential?: string;
};

type TurnCredentialsResponse = {
  code: number;
  data?: {
    username: string;
    credential: string;
    urls: string[];
  };
  message?: string;
};

export async function fetchTunnelIceServersJSON(): Promise<string> {
  const response = await apiGet<TurnCredentialsResponse>('/tunnel/turn-credentials');
  if (!response || response.code !== 0 || !response.data) {
    throw new Error(response?.message ?? 'Failed to fetch TURN credentials');
  }

  const iceServers: ICEServerPayload[] = [
    {
      urls: response.data.urls,
      username: response.data.username,
      credential: response.data.credential,
    },
  ];

  return JSON.stringify(iceServers);
}
