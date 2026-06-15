import { apiGet } from './api';
import { setBackgroundSilentAudioEnabled } from './SyncEngineModule';

export interface AppConfig {
  giftCard: {
    enabled: boolean;
  };
  backgroundSilentAudio: {
    enabled: boolean;
  };
  network: {
    callerPublicIp: string | null;
  };
}

interface AppConfigResponse {
  features?: {
    gift_card?: {
      enabled?: boolean;
    };
    background_silent_audio?: {
      enabled?: boolean;
    };
  };
  network?: {
    caller_public_ip?: unknown;
  };
}

export function normalizePublicIPv4(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const parts = trimmed.split('.');
  if (parts.length !== 4) return null;

  const octets = parts.map(part => {
    if (!/^\d{1,3}$/.test(part)) return null;
    if (part.length > 1 && part.startsWith('0')) return null;
    const parsed = Number(part);
    return parsed >= 0 && parsed <= 255 ? parsed : null;
  });
  if (octets.some(octet => octet === null)) return null;
  const [a, b] = octets as [number, number, number, number];

  if (a === 0 || a === 10 || a === 127 || a >= 224) return null;
  if (a === 100 && b >= 64 && b <= 127) return null;
  if (a === 169 && b === 254) return null;
  if (a === 172 && b >= 16 && b <= 31) return null;
  if (a === 192 && b === 168) return null;

  return `${a}.${b}.${octets[2]}.${octets[3]}`;
}

export async function getAppConfig(): Promise<AppConfig> {
  const data = await apiGet<AppConfigResponse>('/config', {
    skipAuth: true,
  });

  return {
    giftCard: {
      enabled: data.features?.gift_card?.enabled === true,
    },
    backgroundSilentAudio: {
      enabled: data.features?.background_silent_audio?.enabled === true,
    },
    network: {
      callerPublicIp: normalizePublicIPv4(data.network?.caller_public_ip),
    },
  };
}

export async function refreshNativeAppFeatureSettings(): Promise<void> {
  const config = await getAppConfig();
  await setBackgroundSilentAudioEnabled(config.backgroundSilentAudio.enabled);
}
