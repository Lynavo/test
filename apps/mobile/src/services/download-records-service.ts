import AsyncStorage from '@react-native-async-storage/async-storage';

export interface DownloadRecord {
  id: string;
  resourceId: string;
  filename: string;
  fileSize?: number;
  mediaType?: string;
  downloadedAt: string;
  localPath?: string | null;
  savedToPhotos?: boolean;
}

interface RecordDownloadedFileInput {
  resourceId: string;
  filename: string;
  fileSize?: number;
  mediaType?: string;
  localPath?: string | null;
  savedToPhotos?: boolean;
}

const STORAGE_KEY = 'syncflow:download-records:v1';
const MAX_RECORDS = 50;

function isDownloadRecord(value: unknown): value is DownloadRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<DownloadRecord>;
  return (
    typeof record.id === 'string' &&
    typeof record.resourceId === 'string' &&
    typeof record.filename === 'string' &&
    typeof record.downloadedAt === 'string'
  );
}

export async function listDownloadRecords(): Promise<DownloadRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isDownloadRecord)
      .sort(
        (a, b) =>
          new Date(b.downloadedAt).getTime() -
          new Date(a.downloadedAt).getTime(),
      );
  } catch {
    return [];
  }
}

export async function recordDownloadedFile(
  input: RecordDownloadedFileInput,
): Promise<DownloadRecord> {
  const record: DownloadRecord = {
    id: input.resourceId,
    resourceId: input.resourceId,
    filename: input.filename,
    fileSize: input.fileSize,
    mediaType: input.mediaType,
    downloadedAt: new Date().toISOString(),
    localPath: input.localPath ?? null,
    savedToPhotos: input.savedToPhotos,
  };
  const records = await listDownloadRecords();
  const nextRecords = [
    record,
    ...records.filter(item => item.resourceId !== input.resourceId),
  ].slice(0, MAX_RECORDS);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextRecords));
  return record;
}
