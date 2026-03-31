import { PROTOCOL_PORT } from '@syncflow/contracts';

import {
  buildManualPairDevice,
  normalizeManualPairHost,
} from '../deviceDiscoveryManualPairing';

describe('deviceDiscoveryManualPairing', () => {
  it('normalizes a valid IPv4 address', () => {
    expect(normalizeManualPairHost(' 192.168.0.1 ')).toBe('192.168.0.1');
  });

  it('rejects an invalid IPv4 address', () => {
    expect(normalizeManualPairHost('172.16.8.999')).toBeNull();
    expect(normalizeManualPairHost('desktop.local')).toBeNull();
  });

  it('builds a manual pairing device from a valid IPv4 address', () => {
    expect(buildManualPairDevice('192.168.0.1')).toEqual({
      deviceId: 'manual-192.168.0.1',
      name: '192.168.0.1',
      ip: '192.168.0.1',
      type: 'win',
      port: PROTOCOL_PORT,
    });
  });

  it('returns null when building a manual pairing device from invalid input', () => {
    expect(buildManualPairDevice('172.16.8')).toBeNull();
  });
});
