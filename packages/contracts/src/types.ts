import type {
  AutoUploadState,
  AutoUploadTimeRangeMode,
  ConnectionState,
  DeviceDashboardStatus,
  DeviceType,
  ShareStatus,
  UploadState,
  UploadTaskSource,
} from './enums';

// ── Device Discovery ──

export interface DiscoveredDeviceDTO {
  deviceId: string;
  name: string;
  type: DeviceType;
  ip: string;
  port: number;
  protoVersion: number;
  authMode: 'code';
  shareEnabled: boolean;
  shareName?: string;
  lastSeenAt: string;
}

// ── Desktop Dashboard ──

export interface DashboardSummaryDTO {
  todayUploadCount: number;
  todayOccupiedBytes: number;
  remainingBytes: number;
  isDiskLow: boolean;
  lastSuccessfulSyncAt?: string;
  lastSuccessfulDeviceName?: string;
}

export interface DashboardDeviceDTO {
  deviceId: string;
  /** Resolved display label: deviceAlias ?? clientName ?? clientId */
  displayName: string;
  /** Raw device name reported at pairing time; kept for diagnostics */
  clientName: string;
  /** Device platform identifier, e.g. "ios", "android" */
  platform: string;
  ip: string;
  status: DeviceDashboardStatus;
  todayFileCount: number;
  todayBytes: number;
  /** Pre-formatted display value such as "1.2 TB" */
  storageLeft: string;
  /** Receive root used to resolve per-file relative paths */
  storagePath: string;
  /** Device-specific directory under receive root */
  devicePath: string;
  /** User-defined alias, if set (observability / diagnostics) */
  deviceAlias?: string;
  /** Stable directory name on disk (observability / diagnostics) */
  receiveDirName?: string;
  currentFile?: {
    filename: string;
    progress: number;
    fileSize: number;
  };
}

// ── Desktop Device Detail ──

export interface DeviceFileLedgerDTO {
  fileKey: string;
  originalFilename: string;
  mediaType: string;
  fileSize: number;
  createdAtRemote?: string;
  completedAt?: string;
  activeTransmissionMs: number;
  finalPath?: string;
}

export type DeviceFileSortField =
  | 'name'
  | 'size'
  | 'completedAt'
  | 'createdAt'
  | 'duration';

export type SortDirection = 'asc' | 'desc';

export interface DeviceFileLedgerPageDTO {
  items: DeviceFileLedgerDTO[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalBytes: number;
  totalActiveTransmissionMs: number;
}

// ── Desktop Settings ──

export interface SettingsDTO {
  deviceName: string;
  connectionCode: string;
  rootPath: string;
  receivePath: string;
  sharedPath: string;
  shareAddress: string;
  shareStatus: ShareStatus;
  shareName: string;
}

export interface ShareStatusDTO {
  enabled: boolean;
  smbUrl: string | null;
  status: ShareStatus;
  shareName?: string;
  lastValidatedAt?: string;
  lastError?: string;
}

// ── Mobile Sync ──

export interface SyncSummaryDTO {
  currentDeviceId: string | null;
  currentDeviceName: string | null;
  currentSpeedMbps: number;
  /** Bytes confirmed by sidecar ACK */
  transferredBytes: number;
  /** Equals SYNC_BEGIN_REQ.queueTotalBytes */
  totalBytes: number;
  progressPercent: number;
  uploadState: UploadState;
  performanceHint?: 'none' | 'thermal_limited';
  performanceMessage?: string | null;
  thermalState?: 'nominal' | 'fair' | 'serious' | 'critical' | 'unknown';
  activeTuningProfile?: string | null;
  isThermalLimited?: boolean;
  /** Source of the currently uploading task (auto or manual) */
  currentTaskSource?: UploadTaskSource | null;
  /** Current state of the auto-upload feature */
  autoUploadState?: AutoUploadState;
  /** Number of pending items in the manual upload queue */
  manualPending?: number;
  /** Number of pending auto-upload items */
  autoPending?: number;
}

export interface ReadOnlyQueueItemDTO {
  fileKey: string;
  filename: string;
  fileSize: number;
  mediaType: string;
  /** Simplified status for RN display; failed/skipped items are excluded from the read-only queue */
  status: 'uploading' | 'waiting' | 'completed' | 'cancelled';
  progress?: number;
  /** Upload source: auto-scanned or manually selected */
  source?: UploadTaskSource;
  /** Manual batch group identifier */
  batchId?: string;
}

// ── Mobile Binding State ──

export interface BindingStateDTO {
  deviceId: string;
  deviceName: string;
  /** User-defined alias, defaults to deviceName */
  deviceAlias: string;
  host: string;
  port: number;
  connectionState: ConnectionState;
  pairingId: string;
  shareEnabled: boolean;
  shareName?: string;
  lastBoundAt: string;
}

// ── History (shared by both sides) ──

/**
 * Desktop: deviceId = iPhone's clientId
 * Mobile: deviceId = Mac's serverId
 * Same fields, different direction.
 */
export interface HistoryLedgerCardDTO {
  dateKey: string; // YYYY-MM-DD
  deviceId: string;
  deviceName: string;
  deviceIp: string;
  totalFileCount: number;
  totalBytes: number;
  activeTransmissionSeconds: number;
}

// ── Vivi Drop: Album & Shared Files ──

/** Album asset item for the album workbench browser */
export interface AlbumAssetDTO {
  assetLocalId: string;
  filename: string;
  mediaType: 'image' | 'video';
  fileSize: number;
  creationDate: string;
  thumbnailUri: string;
  isTransferred: boolean;
  isQueued: boolean;
}

/** Auto-upload configuration (single-row persisted on mobile) */
export interface AutoUploadConfigDTO {
  enabled: boolean;
  timeRangeMode: AutoUploadTimeRangeMode;
  /** ISO 8601 timestamp, only used when timeRangeMode is 'custom' */
  customTimeFrom?: string;
  state: AutoUploadState;
}

/** A single file entry in the shared directory listing */
export interface SharedFileDTO {
  name: string;
  path: string;
  type: 'image' | 'video' | 'document' | 'other';
  size: number;
  modifiedAt: string;
  thumbnailUrl?: string;
  streamUrl?: string;
  isDirectory?: boolean;
}

/** Shared directory listing response */
export interface SharedDirectoryDTO {
  path: string;
  files: SharedFileDTO[];
  totalCount: number;
}
