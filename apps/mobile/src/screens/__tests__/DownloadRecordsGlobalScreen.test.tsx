import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

let mockVisualQaEnabled = false;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    canGoBack: jest.fn(() => true),
    goBack: jest.fn(),
    reset: jest.fn(),
  }),
  useFocusEffect: (effect: () => void | (() => void)) => {
    const ReactInner = require('react');
    ReactInner.useEffect(effect, [effect]);
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../../components/Icon', () => ({
  Icon: ({ name }: { name: string }) => {
    const ReactInner = require('react');
    const { Text } = require('react-native');
    return ReactInner.createElement(Text, null, name);
  },
}));

jest.mock('../../components/GlobalGradientBackground', () => ({
  GlobalGradientBackground: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

jest.mock('../components/GlobalSyncActivityHomeSections', () => ({
  GlobalMediaPreviewIcon: ({ type }: { type: string }) => {
    const ReactInner = require('react');
    const { Text } = require('react-native');
    return ReactInner.createElement(Text, null, `preview-${type}`);
  },
}));

jest.mock('../../services/download-records-service', () => ({
  listDownloadRecords: jest.fn(),
}));

jest.mock('../../dev/visualQa', () => ({
  isVisualQaEnabled: () => mockVisualQaEnabled,
}));

import { listDownloadRecords } from '../../services/download-records-service';
import { DownloadRecordsGlobalScreen } from '../DownloadRecordsGlobalScreen';

const mockedListDownloadRecords = listDownloadRecords as jest.MockedFunction<
  typeof listDownloadRecords
>;

describe('DownloadRecordsGlobalScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVisualQaEnabled = false;
  });

  it('renders a dedicated empty download records page', async () => {
    mockedListDownloadRecords.mockResolvedValueOnce([]);

    const { getByText } = render(<DownloadRecordsGlobalScreen />);

    await waitFor(() => {
      expect(getByText('最近下载')).toBeTruthy();
      expect(getByText('暂无最近下载')).toBeTruthy();
      expect(getByText('从电脑下载到本机的文件会出现在这里。')).toBeTruthy();
    });
  });

  it('renders visual QA mock downloads when the download history is empty', async () => {
    mockVisualQaEnabled = true;
    mockedListDownloadRecords.mockResolvedValueOnce([]);

    const { getByText, queryByText } = render(<DownloadRecordsGlobalScreen />);

    await waitFor(() => {
      expect(getByText('Client-Handoff.mov')).toBeTruthy();
      expect(getByText('Campaign-Keyframes.zip')).toBeTruthy();
    });
    expect(queryByText('暂无最近下载')).toBeNull();
  });

  it('renders downloaded files using the reference list layout copy', async () => {
    mockedListDownloadRecords.mockResolvedValueOnce([
      {
        id: 'download-1',
        resourceId: 'download-1',
        filename: 'Vacation-01.JPG',
        fileSize: 8.4 * 1024 * 1024,
        mediaType: 'image/jpeg',
        downloadedAt: '2026-06-16T02:42:00.000Z',
      },
    ]);

    const { getByText } = render(<DownloadRecordsGlobalScreen />);

    await waitFor(() => {
      expect(getByText('Vacation-01.JPG')).toBeTruthy();
      expect(getByText('照片 · 8.4 MB')).toBeTruthy();
    });
  });
});
