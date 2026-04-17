import { buildOverview } from '../SyncActivityScreen';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    dispatch: jest.fn(),
  }),
  CommonActions: {
    reset: jest.fn(),
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../../components/Icon', () => ({
  Icon: () => null,
}));

jest.mock('../../stores/auth-store', () => ({
  useAuth: () => ({
    isLoggedIn: false,
    user: null,
  }),
  isFeatureAccessAllowed: () => true,
}));

describe('buildOverview', () => {
  it('clears stale current file fields when scanning payload explicitly sends null', () => {
    const prev = {
      progressPercent: 100,
      currentSpeedMbps: 12.4,
      uploadState: 'completed',
      completedCount: 8,
      totalCount: 8,
      completedBytes: 1024,
      totalBytes: 1024,
      currentFile: 'old-file-key',
      currentFilename: 'old-file.jpg',
      currentFileConfirmedBytes: 1024,
      currentFileTotalBytes: 1024,
      currentTaskSource: null,
      autoUploadState: 'active' as const,
      manualPending: 0,
      autoPending: 0,
    };

    const next = buildOverview(
      {
        uploadState: 'scanning',
        progressPercent: 0,
        currentFile: null,
        currentFilename: null,
        currentFileConfirmedBytes: 0,
        currentFileTotalBytes: 0,
      },
      prev,
    );

    expect(next.uploadState).toBe('scanning');
    expect(next.progressPercent).toBe(0);
    expect(next.currentFile).toBeUndefined();
    expect(next.currentFilename).toBeUndefined();
    expect(next.currentFileConfirmedBytes).toBe(0);
    expect(next.currentFileTotalBytes).toBe(0);
  });

  it('keeps previous file fields only when payload omits them entirely', () => {
    const prev = {
      progressPercent: 35,
      currentSpeedMbps: 8.2,
      uploadState: 'uploading',
      completedCount: 2,
      totalCount: 5,
      completedBytes: 512,
      totalBytes: 2048,
      currentFile: 'file-key-1',
      currentFilename: 'clip.mov',
      currentFileConfirmedBytes: 350,
      currentFileTotalBytes: 1000,
      currentTaskSource: 'auto' as const,
      autoUploadState: 'active' as const,
      manualPending: 0,
      autoPending: 1,
    };

    const next = buildOverview(
      {
        uploadState: 'uploading',
      },
      prev,
    );

    expect(next.currentFile).toBe('file-key-1');
    expect(next.currentFilename).toBe('clip.mov');
    expect(next.currentFileConfirmedBytes).toBe(350);
    expect(next.currentFileTotalBytes).toBe(1000);
  });

  it('captures the last completed task source for the completion card', () => {
    const prev = {
      progressPercent: 92,
      currentSpeedMbps: 8.2,
      uploadState: 'uploading',
      completedCount: 11,
      totalCount: 12,
      completedBytes: 4096,
      totalBytes: 8192,
      currentFile: 'file-key-2',
      currentFilename: 'clip-2.mov',
      currentFileConfirmedBytes: 950,
      currentFileTotalBytes: 1000,
      currentTaskSource: 'manual' as const,
      lastCompletedTaskSource: null,
      autoUploadState: 'disabled' as const,
      manualPending: 0,
      autoPending: 0,
    };

    const next = buildOverview(
      {
        uploadState: 'completed',
        completedCount: 12,
        totalCount: 12,
        completedBytes: 8192,
        currentTaskSource: null,
      },
      prev,
    );

    expect(next.uploadState).toBe('completed');
    expect(next.currentTaskSource).toBeUndefined();
    expect(next.lastCompletedTaskSource).toBe('manual');
  });
});
