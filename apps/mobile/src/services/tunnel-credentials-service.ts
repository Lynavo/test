import { apiGet } from './api';

type ICEServerPayload = {
  urls: string[];
  username?: string;
  credential?: string;
};

type TurnCredentialsData = {
  username: string;
  credential: string;
  urls: string[];
};

export async function fetchTunnelIceServersJSON(): Promise<string> {
  const data = await apiGet<TurnCredentialsData>('/tunnel/turn-credentials');
  if (
    !data ||
    !Array.isArray(data.urls) ||
    data.urls.length === 0 ||
    typeof data.username !== 'string' ||
    typeof data.credential !== 'string'
  ) {
    throw new Error('Failed to fetch TURN credentials');
  }

  const iceServers: ICEServerPayload[] = [
    {
      urls: data.urls,
      username: data.username,
      credential: data.credential,
    },
  ];

  return JSON.stringify(iceServers);
}
