export type MobileConnectionState =
  | 'bound'
  | 'connecting'
  | 'connected'
  | 'offline'
  | 'discovering';

type SyncConnectionEvidence = {
  progressPercent?: number | null;
  queueHasUploadingItem?: boolean;
  transferredBytes?: number | null;
  uploadState?: string | null;
};

export function syncActivityImpliesConnected(
  evidence: SyncConnectionEvidence,
): boolean {
  if (evidence.uploadState === 'uploading' || evidence.uploadState === 'completed') {
    return true;
  }

  if ((evidence.progressPercent ?? 0) > 0 || (evidence.transferredBytes ?? 0) > 0) {
    return true;
  }

  return evidence.queueHasUploadingItem === true;
}

export function getEffectiveConnectionState(
  connectionState: MobileConnectionState | null | undefined,
  evidence: SyncConnectionEvidence,
): MobileConnectionState | null | undefined {
  if (syncActivityImpliesConnected(evidence)) {
    return 'connected';
  }

  return connectionState;
}
