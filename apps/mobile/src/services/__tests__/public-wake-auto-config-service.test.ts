import { autoConfigurePublicWakeTargetFromBinding } from '../public-wake-auto-config-service';
import { recordDiagnosticsLog } from '../diagnostics-log-service';
import { getSuggestedPublicWakeHost } from '../public-wake-service';
import { savePublicWakeTarget } from '../SyncEngineModule';

jest.mock('../diagnostics-log-service', () => ({
  recordDiagnosticsLog: jest.fn(),
}));

jest.mock('../public-wake-service', () => ({
  getSuggestedPublicWakeHost: jest.fn(),
}));

jest.mock('../SyncEngineModule', () => ({
  savePublicWakeTarget: jest.fn(),
}));

describe('public-wake-auto-config-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSuggestedPublicWakeHost as jest.Mock).mockResolvedValue('8.8.8.8');
    (savePublicWakeTarget as jest.Mock).mockResolvedValue(undefined);
  });

  it('saves an enabled public wake target when LAN wake metadata exists', async () => {
    const result = await autoConfigurePublicWakeTargetFromBinding({
      deviceId: 'desktop-1',
      host: '192.168.1.20',
      connectionState: 'connected',
      wake: {
        targets: [
          {
            macAddress: 'aa:bb:cc:dd:ee:ff',
            broadcastAddress: '192.168.1.255',
            ports: [7, 9],
          },
        ],
        publicTarget: null,
      },
    });

    expect(result).toEqual({
      status: 'saved',
      host: '8.8.8.8',
      port: 7,
    });
    expect(savePublicWakeTarget).toHaveBeenCalledWith({
      host: '8.8.8.8',
      port: 7,
      enabled: true,
    });
    expect(recordDiagnosticsLog).toHaveBeenCalledWith(
      'PublicWake',
      'auto-config saved enabled target',
      {
        host: '8.8.8.8',
        port: 7,
      },
    );
  });

  it('does not overwrite an existing public wake target', async () => {
    const result = await autoConfigurePublicWakeTargetFromBinding({
      deviceId: 'desktop-1',
      host: '192.168.1.20',
      connectionState: 'connected',
      wake: {
        targets: [
          {
            macAddress: 'aa:bb:cc:dd:ee:ff',
            broadcastAddress: '192.168.1.255',
            ports: [9],
          },
        ],
        publicTarget: {
          host: 'home.example.net',
          port: 40009,
          enabled: true,
        },
      },
    });

    expect(result).toEqual({
      status: 'skipped',
      reason: 'public_target_exists',
    });
    expect(getSuggestedPublicWakeHost).not.toHaveBeenCalled();
    expect(savePublicWakeTarget).not.toHaveBeenCalled();
  });

  it('does not save when the backend cannot suggest a public host', async () => {
    (getSuggestedPublicWakeHost as jest.Mock).mockResolvedValueOnce(null);

    const result = await autoConfigurePublicWakeTargetFromBinding({
      deviceId: 'desktop-1',
      host: '192.168.1.20',
      connectionState: 'connected',
      wake: {
        targets: [
          {
            macAddress: 'aa:bb:cc:dd:ee:ff',
            broadcastAddress: '192.168.1.255',
            ports: [9],
          },
        ],
        publicTarget: null,
      },
    });

    expect(result).toEqual({
      status: 'skipped',
      reason: 'public_host_unavailable',
    });
    expect(savePublicWakeTarget).not.toHaveBeenCalled();
  });

  it('uses UDP port 9 when LAN metadata does not include a valid port', async () => {
    const result = await autoConfigurePublicWakeTargetFromBinding({
      deviceId: 'desktop-1',
      host: '192.168.1.20',
      connectionState: 'connected',
      wake: {
        targets: [
          {
            macAddress: 'aa:bb:cc:dd:ee:ff',
            broadcastAddress: '192.168.1.255',
            ports: [0, 70000],
          },
        ],
        publicTarget: null,
      },
    });

    expect(result).toEqual({
      status: 'saved',
      host: '8.8.8.8',
      port: 9,
    });
    expect(savePublicWakeTarget).toHaveBeenCalledWith({
      host: '8.8.8.8',
      port: 9,
      enabled: true,
    });
  });

  it('enables an existing disabled public wake target when LAN wake metadata exists', async () => {
    const result = await autoConfigurePublicWakeTargetFromBinding({
      deviceId: 'desktop-1',
      host: '192.168.1.20',
      connectionState: 'connected',
      wake: {
        targets: [
          {
            macAddress: 'aa:bb:cc:dd:ee:ff',
            broadcastAddress: '192.168.1.255',
            ports: [9],
          },
        ],
        publicTarget: {
          host: '8.8.8.8',
          port: 9,
          enabled: false,
        },
      },
    });

    expect(result).toEqual({
      status: 'saved',
      host: '8.8.8.8',
      port: 9,
    });
    expect(savePublicWakeTarget).toHaveBeenCalledWith({
      host: '8.8.8.8',
      port: 9,
      enabled: true,
    });
  });

  it('does not save when the binding is not currently connected over LAN', async () => {
    const result = await autoConfigurePublicWakeTargetFromBinding({
      deviceId: 'desktop-1',
      host: '192.168.1.20',
      connectionState: 'offline',
      wake: {
        targets: [
          {
            macAddress: 'aa:bb:cc:dd:ee:ff',
            broadcastAddress: '192.168.1.255',
            ports: [9],
          },
        ],
        publicTarget: null,
      },
    });

    expect(result).toEqual({
      status: 'skipped',
      reason: 'lan_context_unconfirmed',
    });
    expect(getSuggestedPublicWakeHost).not.toHaveBeenCalled();
    expect(savePublicWakeTarget).not.toHaveBeenCalled();
  });

  it('does not save when the binding host is not a private LAN IPv4 address', async () => {
    const result = await autoConfigurePublicWakeTargetFromBinding({
      deviceId: 'desktop-1',
      host: '8.8.4.4',
      connectionState: 'connected',
      wake: {
        targets: [
          {
            macAddress: 'aa:bb:cc:dd:ee:ff',
            broadcastAddress: '192.168.1.255',
            ports: [9],
          },
        ],
        publicTarget: null,
      },
    });

    expect(result).toEqual({
      status: 'skipped',
      reason: 'lan_context_unconfirmed',
    });
    expect(getSuggestedPublicWakeHost).not.toHaveBeenCalled();
    expect(savePublicWakeTarget).not.toHaveBeenCalled();
  });

  it('does not save when shared files are connected through relay instead of LAN', async () => {
    const result = await autoConfigurePublicWakeTargetFromBinding({
      deviceId: 'desktop-1',
      host: '192.168.1.20',
      connectionState: 'connected',
      sharedFilesReachability: {
        state: 'available',
        route: 'relay',
      },
      wake: {
        targets: [
          {
            macAddress: 'aa:bb:cc:dd:ee:ff',
            broadcastAddress: '192.168.1.255',
            ports: [9],
          },
        ],
        publicTarget: null,
      },
    });

    expect(result).toEqual({
      status: 'skipped',
      reason: 'lan_context_unconfirmed',
    });
    expect(getSuggestedPublicWakeHost).not.toHaveBeenCalled();
    expect(savePublicWakeTarget).not.toHaveBeenCalled();
  });
});
