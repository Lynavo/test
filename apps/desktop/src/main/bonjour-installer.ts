import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import type { IncomingMessage } from 'node:http';
import https from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import log from 'electron-log';
import {
  BONJOUR_INSTALL_ERROR_CODES,
  BONJOUR_WINDOWS_INSTALLER_NAME,
  BONJOUR_WINDOWS_INSTALLER_URL,
  BONJOUR_WINDOWS_SUPPORT_URL,
  type BonjourInstallResult,
} from '../shared/bonjour';
import type { SidecarManager } from './sidecar-manager';

const maxRedirects = 5;

export async function installBonjourForWindows(
  sidecarManager: SidecarManager,
): Promise<BonjourInstallResult> {
  if (process.platform !== 'win32') {
    throw new Error(BONJOUR_INSTALL_ERROR_CODES.unsupportedPlatform);
  }

  const currentRuntime = sidecarManager.detectBonjourRuntime();
  if (currentRuntime.status === 'native') {
    if (sidecarManager.getState().bonjour.status !== 'native') {
      await sidecarManager.retryStart();
    }
    return {
      status: 'already_installed',
      message: null,
      messageCode: 'alreadyInstalled',
      supportUrl: BONJOUR_WINDOWS_SUPPORT_URL,
      installerPath: null,
      bonjourPath: currentRuntime.path,
    };
  }

  const installerPath = await downloadBonjourInstaller();
  await runBonjourInstaller(installerPath);
  await sidecarManager.retryStart();

  const nextRuntime = sidecarManager.getState().bonjour;
  if (nextRuntime.status !== 'native') {
    throw new Error(BONJOUR_INSTALL_ERROR_CODES.postInstallNotDetected);
  }

  return {
    status: 'installed',
    message: null,
    messageCode: 'installed',
    supportUrl: BONJOUR_WINDOWS_SUPPORT_URL,
    installerPath,
    bonjourPath: nextRuntime.path,
  };
}

async function downloadBonjourInstaller(): Promise<string> {
  const installerDir = join(tmpdir(), 'LynavoDrive', 'bonjour-installer');
  const installerPath = join(installerDir, BONJOUR_WINDOWS_INSTALLER_NAME);

  await mkdir(installerDir, { recursive: true });
  await rm(installerPath, { force: true });
  await downloadFile(BONJOUR_WINDOWS_INSTALLER_URL, installerPath, maxRedirects);
  log.info(`[BonjourInstaller] downloaded installer to ${installerPath}`);
  return installerPath;
}

async function downloadFile(
  url: string,
  destinationPath: string,
  redirectsRemaining: number,
): Promise<void> {
  const response = await request(url);

  if (
    response.statusCode &&
    response.statusCode >= 300 &&
    response.statusCode < 400 &&
    response.headers.location
  ) {
    response.resume();
    if (redirectsRemaining <= 0) {
      throw new Error(BONJOUR_INSTALL_ERROR_CODES.tooManyRedirects);
    }
    const redirectedURL = new URL(response.headers.location, url).toString();
    await downloadFile(redirectedURL, destinationPath, redirectsRemaining - 1);
    return;
  }

  if (response.statusCode !== 200) {
    response.resume();
    throw new Error(
      `${BONJOUR_INSTALL_ERROR_CODES.downloadHttp}:${response.statusCode ?? 'unknown'}`,
    );
  }

  await pipeline(response, createWriteStream(destinationPath));
}

function request(url: string): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (response) => resolve(response));
    req.on('error', (error) => reject(error));
  });
}

async function runBonjourInstaller(installerPath: string): Promise<void> {
  const quotedPath = installerPath.replace(/'/g, "''");
  const command = [
    "$ErrorActionPreference = 'Stop'",
    `$process = Start-Process -FilePath '${quotedPath}' -Verb RunAs -PassThru -Wait`,
    'exit $process.ExitCode',
  ].join('; ');

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('exit', (code) => {
      if (code === 0) {
        log.info(`[BonjourInstaller] installer exited successfully: ${installerPath}`);
        resolve();
        return;
      }

      const detail = stderr.trim();
      if (detail.includes('The operation was canceled by the user')) {
        reject(new Error(BONJOUR_INSTALL_ERROR_CODES.canceled));
        return;
      }

      reject(new Error(`${BONJOUR_INSTALL_ERROR_CODES.failedExit}:${code ?? 'unknown'}`));
    });
  });
}
