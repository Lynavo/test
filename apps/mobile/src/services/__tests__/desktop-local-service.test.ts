import { NativeModules } from 'react-native';

import {
  downloadResource,
  downloadResourceForGlobal,
  isDownloadSavedLocally,
  listSharedFolderContents,
} from '../desktop-local-service';
import { getClientId } from '../SyncEngineModule';

jest.mock('react-native', () => ({
  NativeModules: {
    NativeSyncEngine: {
      getClientDisplayName: jest.fn(),
    },
  },
}));

jest.mock('../SyncEngineModule', () => ({
  getClientId: jest.fn(),
}));

const mockedGetClientId = getClientId as jest.MockedFunction<
  typeof getClientId
>;
const mockGetClientDisplayName = NativeModules.NativeSyncEngine
  ?.getClientDisplayName as jest.MockedFunction<() => Promise<string>>;

describe('desktop-local-service', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetClientId.mockResolvedValue('client-001');
    mockGetClientDisplayName.mockResolvedValue('Alice iPhone');
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock;
  });

  it('keeps the legacy CN downloadResource request without manufacturing a local path', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      statusText: 'OK',
    });

    await expect(
      downloadResource({ host: '192.168.10.20', port: 39394 }, 'resource-1'),
    ).resolves.toEqual({
      savedToPhotos: false,
      localPath: null,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://192.168.10.20:39394/resources/mobile/download/resource-1?clientId=client-001&clientName=Alice%20iPhone',
    );
  });

  it('exposes a global-only download result without pretending local persistence exists', async () => {
    await expect(
      downloadResourceForGlobal(
        { host: '192.168.10.20', port: 39394 },
        'resource-1',
      ),
    ).resolves.toEqual({
      savedToPhotos: false,
      localPath: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lists a shared folder with encoded nested path segments', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      statusText: 'OK',
      json: jest.fn().mockResolvedValue({
        path: 'Design Assets/June',
        files: [
          {
            name: 'hero.png',
            path: 'Design Assets/June/hero.png',
            type: 'image',
            size: 1024,
            modifiedAt: '2026-06-16T08:00:00.000Z',
          },
        ],
        totalCount: 1,
      }),
    });

    await expect(
      listSharedFolderContents(
        { host: '192.168.10.20', port: 39394 },
        'resource-1',
        'Design Assets/June',
      ),
    ).resolves.toEqual({
      path: 'Design Assets/June',
      files: [
        {
          name: 'hero.png',
          path: 'Design Assets/June/hero.png',
          type: 'image',
          size: 1024,
          modifiedAt: '2026-06-16T08:00:00.000Z',
        },
      ],
      totalCount: 1,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://192.168.10.20:39394/resources/mobile/shared/resource-1/list/Design%20Assets/June?clientId=client-001&clientName=Alice%20iPhone',
    );
  });

  it('detects whether a download result was actually saved locally', () => {
    expect(
      isDownloadSavedLocally({ savedToPhotos: false, localPath: null }),
    ).toBe(false);
    expect(
      isDownloadSavedLocally({ savedToPhotos: false, localPath: '  ' }),
    ).toBe(false);
    expect(
      isDownloadSavedLocally({
        savedToPhotos: false,
        localPath: '/tmp/report.pdf',
      }),
    ).toBe(true);
    expect(
      isDownloadSavedLocally({ savedToPhotos: true, localPath: null }),
    ).toBe(true);
  });
});
