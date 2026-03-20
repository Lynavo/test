import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  startDiscovery(): void;
  stopDiscovery(): void;
  getDiscoveredDevices(): Promise<Array<{
    deviceId: string;
    displayName: string;
    ip: string;
    type: 'mac' | 'win';
    connectionState: 'discovering' | 'bound' | 'connecting' | 'connected' | 'offline';
    requiresCode: boolean;
  }>>;

  verifyConnectionCode(deviceId: string, code: string): Promise<{
    success: boolean;
    token?: string;
    errorCode?: string;
  }>;

  getSyncSummary(): Promise<{
    currentDeviceId: string | null;
    currentDeviceName: string | null;
    currentSpeedMbps: number;
    transferredBytes: number;
    totalBytes: number;
    progressPercent: number;
    uploadState: string;
  }>;

  getHistoryCards(): Promise<Array<{
    dateKey: string;
    deviceId: string;
    deviceName: string;
    deviceIp: string;
    totalFileCount: number;
    totalBytes: number;
    activeTransmissionSeconds: number;
  }>>;

  disconnectCurrentDevice(): Promise<void>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeSyncEngine');
