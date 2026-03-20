export type DeviceType = 'mac' | 'win';

/** Used for Mobile BindingStateDTO.connectionState and device discovery list */
export type ConnectionState =
  | 'discovering' | 'bound' | 'connecting' | 'connected' | 'offline';

export type UploadState =
  | 'idle' | 'scanning' | 'queued' | 'uploading'
  | 'paused' | 'retrying' | 'completed' | 'failed';

export type SidecarUploadStatus =
  | 'receiving' | 'paused_resumable' | 'completed'
  | 'skipped_duplicate' | 'rejected_low_disk' | 'failed';

export type DeviceDashboardStatus = 'transferring' | 'connected_idle' | 'offline';

export type ShareStatus =
  | 'unknown' | 'needs_manual_enable' | 'share_registered' | 'ready' | 'error';

export type FileInitAction = 'UPLOAD' | 'RESUME' | 'SKIP' | 'REJECT';

/** iPhone sync engine state machine */
export type SyncEngineState =
  | 'idle' | 'discovering' | 'scanning' | 'preparing'
  | 'syncing_foreground' | 'syncing_background'
  | 'backoff_waiting' | 'paused_no_target'
  | 'paused_no_permission' | 'stopped';

/** iPhone upload_items status */
export type MobileUploadItemStatus =
  | 'discovered' | 'preparing' | 'ready'
  | 'uploading' | 'completed' | 'failed' | 'skipped';
