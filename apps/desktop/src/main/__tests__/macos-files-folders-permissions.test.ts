import { describe, expect, it, vi } from 'vitest';
import { homedir } from 'node:os';
import { requestMacFilesAndFoldersPermissionsOnStartup } from '../macos-files-folders-permissions';

describe('requestMacFilesAndFoldersPermissionsOnStartup', () => {
  it('touches Desktop, Documents, and Downloads on macOS startup', async () => {
    const readdir = vi.fn().mockResolvedValue([]);
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
    };

    await requestMacFilesAndFoldersPermissionsOnStartup({
      platform: 'darwin',
      homeDirectory: '/Users/vivi',
      readdir,
      logger,
    });

    expect(readdir).toHaveBeenCalledTimes(3);
    expect(readdir).toHaveBeenCalledWith('/Users/vivi/Desktop', { withFileTypes: true });
    expect(readdir).toHaveBeenCalledWith('/Users/vivi/Documents', { withFileTypes: true });
    expect(readdir).toHaveBeenCalledWith('/Users/vivi/Downloads', { withFileTypes: true });
    expect(logger.info).toHaveBeenCalledWith(
      '[Permissions] requested macOS Files and Folders access for Desktop, Documents, Downloads',
    );
  });

  it('does not touch protected folders on non-macOS platforms', async () => {
    const readdir = vi.fn().mockResolvedValue([]);

    await requestMacFilesAndFoldersPermissionsOnStartup({
      platform: 'win32',
      homeDirectory: '/Users/vivi',
      readdir,
      logger: { info: vi.fn(), warn: vi.fn() },
    });

    expect(readdir).not.toHaveBeenCalled();
  });

  it('keeps startup best-effort when a protected folder cannot be read', async () => {
    const denied = new Error('operation not permitted');
    const readdir = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(denied)
      .mockResolvedValueOnce([]);
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
    };

    await expect(
      requestMacFilesAndFoldersPermissionsOnStartup({
        platform: 'darwin',
        homeDirectory: homedir(),
        readdir,
        logger,
      }),
    ).resolves.toBeUndefined();

    expect(readdir).toHaveBeenCalledTimes(3);
    expect(logger.warn).toHaveBeenCalledWith(
      '[Permissions] macOS Files and Folders access probe failed for Documents',
      denied,
    );
  });
});
