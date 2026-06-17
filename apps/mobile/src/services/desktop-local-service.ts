import { NativeModules } from 'react-native';
import type {
  DesktopSharedResourceDTO,
  ReceivedLibraryItemDTO,
  DesktopSyncRecordDTO,
  SharedDirectoryDTO,
} from '@syncflow/contracts';
import { getClientId } from './SyncEngineModule';

const { NativeSyncEngine } = NativeModules;

export interface DesktopInfo {
  host: string;
  port: number;
}

export interface ResourceDownloadResult {
  savedToPhotos: boolean;
  localPath: string | null;
}

export function isDownloadSavedLocally(result: ResourceDownloadResult): boolean {
  return (
    result.savedToPhotos ||
    (typeof result.localPath === 'string' && result.localPath.trim().length > 0)
  );
}

async function requestResourceDownload(
  desktop: DesktopInfo,
  resourceId: string,
): Promise<void> {
  const clientId = await getClientId();
  const clientName = (await NativeSyncEngine?.getClientDisplayName?.()) || clientId;
  const url = `http://${desktop.host}:${desktop.port}/resources/mobile/download/${resourceId}?clientId=${clientId}&clientName=${encodeURIComponent(
    clientName
  )}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download resource: ${res.statusText}`);
  }
}

function encodeRemotePath(path?: string): string {
  return (path ?? '')
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .filter(segment => segment.trim().length > 0)
    .map(segment => encodeURIComponent(segment))
    .join('/');
}

export async function listSharedResources(
  desktop: DesktopInfo
): Promise<DesktopSharedResourceDTO[]> {
  const clientId = await getClientId();
  const clientName = (await NativeSyncEngine?.getClientDisplayName?.()) || clientId;
  const url = `http://${desktop.host}:${desktop.port}/resources/mobile/shared?clientId=${clientId}&clientName=${encodeURIComponent(
    clientName
  )}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to list shared resources: ${res.statusText}`);
  }
  const data = await res.json();
  return (data.items || []) as DesktopSharedResourceDTO[];
}

export async function listSharedFolderContents(
  desktop: DesktopInfo,
  resourceId: string,
  path?: string,
): Promise<SharedDirectoryDTO> {
  const clientId = await getClientId();
  const clientName = (await NativeSyncEngine?.getClientDisplayName?.()) || clientId;
  const encodedPath = encodeRemotePath(path);
  const pathSuffix = encodedPath ? `/${encodedPath}` : '';
  const url = `http://${desktop.host}:${desktop.port}/resources/mobile/shared/${encodeURIComponent(
    resourceId,
  )}/list${pathSuffix}?clientId=${clientId}&clientName=${encodeURIComponent(
    clientName,
  )}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to list shared folder contents: ${res.statusText}`);
  }
  return (await res.json()) as SharedDirectoryDTO;
}

export async function listReceivedLibrary(
  desktop: DesktopInfo
): Promise<ReceivedLibraryItemDTO[]> {
  const clientId = await getClientId();
  const clientName = (await NativeSyncEngine?.getClientDisplayName?.()) || clientId;
  const url = `http://${desktop.host}:${desktop.port}/resources/mobile/received?clientId=${clientId}&clientName=${encodeURIComponent(
    clientName
  )}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to list received library: ${res.statusText}`);
  }
  const data = await res.json();
  return (data.items || []) as ReceivedLibraryItemDTO[];
}

export async function downloadResource(
  desktop: DesktopInfo,
  resourceId: string
): Promise<ResourceDownloadResult> {
  await requestResourceDownload(desktop, resourceId);

  // CN legacy screens only await completion and do not inspect this result.
  // Keep the HTTP request behavior, but do not manufacture a local file path.
  return {
    savedToPhotos: false,
    localPath: null,
  };
}

export async function downloadResourceForGlobal(
  _desktop: DesktopInfo,
  _resourceId: string,
): Promise<ResourceDownloadResult> {
  // Global must not report a successful local save until native persistence
  // returns a real localPath or confirms the asset was saved to Photos. Do not
  // hit the sidecar download endpoint yet, otherwise desktop-side counters may
  // treat an unsupported client action as a real download.
  return {
    savedToPhotos: false,
    localPath: null,
  };
}

export async function listHistory(
  desktop: DesktopInfo
): Promise<DesktopSyncRecordDTO[]> {
  const clientId = await getClientId();
  const url = `http://${desktop.host}:${desktop.port}/management/records/sync?clientId=${clientId}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to list history: ${res.statusText}`);
  }
  const data = await res.json();
  return (data.items || []) as DesktopSyncRecordDTO[];
}
