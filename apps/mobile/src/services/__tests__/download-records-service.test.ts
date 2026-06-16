import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  listDownloadRecords,
  recordDownloadedFile,
} from '../download-records-service';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

const mockedAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('download-records-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-16T08:30:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('stores downloaded files newest first without mixing sync history', async () => {
    mockedAsyncStorage.getItem.mockResolvedValueOnce(
      JSON.stringify([
        {
          id: 'old-resource',
          resourceId: 'old-resource',
          filename: 'Old.pdf',
          fileSize: 1024,
          mediaType: 'document',
          downloadedAt: '2026-06-15T08:00:00.000Z',
        },
      ]),
    );

    const record = await recordDownloadedFile({
      resourceId: 'real-resource-1',
      filename: 'Real Report.pdf',
      fileSize: 2048,
      mediaType: 'document',
      localPath: '/local/Real Report.pdf',
      savedToPhotos: true,
    });

    expect(record).toMatchObject({
      id: 'real-resource-1',
      filename: 'Real Report.pdf',
      downloadedAt: '2026-06-16T08:30:00.000Z',
    });
    expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
      'syncflow:download-records:v1',
      JSON.stringify([
        record,
        {
          id: 'old-resource',
          resourceId: 'old-resource',
          filename: 'Old.pdf',
          fileSize: 1024,
          mediaType: 'document',
          downloadedAt: '2026-06-15T08:00:00.000Z',
        },
      ]),
    );
  });

  it('reads stored download records and ignores invalid cache payloads', async () => {
    mockedAsyncStorage.getItem.mockResolvedValueOnce('not-json');

    await expect(listDownloadRecords()).resolves.toEqual([]);
  });
});
