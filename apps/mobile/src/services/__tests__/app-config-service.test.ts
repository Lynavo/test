import { getAppConfig, refreshNativeAppFeatureSettings } from '../app-config-service';
import { apiGet } from '../api';
import { setBackgroundSilentAudioEnabled } from '../SyncEngineModule';

jest.mock('../api', () => ({
  apiGet: jest.fn(),
}));

jest.mock('../SyncEngineModule', () => ({
  setBackgroundSilentAudioEnabled: jest.fn(),
}));

describe('app-config-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('parses background silent audio as disabled by default', async () => {
    (apiGet as jest.Mock).mockResolvedValueOnce({
      features: {
        gift_card: { enabled: true },
      },
      network: {
        caller_public_ip: '8.8.8.8',
      },
    });

    await expect(getAppConfig()).resolves.toEqual({
      giftCard: { enabled: true },
      backgroundSilentAudio: { enabled: false },
      network: { callerPublicIp: '8.8.8.8' },
    });
  });

  it('ignores invalid caller public IP values', async () => {
    (apiGet as jest.Mock).mockResolvedValueOnce({
      network: {
        caller_public_ip: '192.168.1.10',
      },
    });

    await expect(getAppConfig()).resolves.toEqual({
      giftCard: { enabled: false },
      backgroundSilentAudio: { enabled: false },
      network: { callerPublicIp: null },
    });
  });

  it('applies the background silent audio flag to the native sync engine', async () => {
    (apiGet as jest.Mock).mockResolvedValueOnce({
      features: {
        background_silent_audio: { enabled: true },
      },
    });

    await refreshNativeAppFeatureSettings();

    expect(setBackgroundSilentAudioEnabled).toHaveBeenCalledWith(true);
  });
});
