import { EventEmitter } from 'node:events';
import { spawn, ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import { app } from 'electron';
import { is } from '@electron-toolkit/utils';
import log from 'electron-log';
import { sidecarClient } from './sidecar-client';
import type { SidecarRuntimeState } from '../shared/sidecar-runtime';
import { INITIAL_SIDECAR_RUNTIME_STATE } from '../shared/sidecar-runtime';

export class SidecarManager extends EventEmitter {
  private process: ChildProcess | null = null;
  private restartCount = 0;
  private maxRestarts = 3;
  private healthInterval: ReturnType<typeof setInterval> | null = null;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private stopping = false;
  private state: SidecarRuntimeState = INITIAL_SIDECAR_RUNTIME_STATE;

  constructor() {
    super();
    this.state = {
      ...INITIAL_SIDECAR_RUNTIME_STATE,
      maxRestarts: this.maxRestarts,
    };
  }

  getState(): SidecarRuntimeState {
    return { ...this.state };
  }

  private getSpawnArgs(): { command: string; args: string[] } {
    if (is.dev) {
      // Dev mode: use `go run` from source
      return { command: 'go', args: ['run', './cmd/syncflow-sidecar/'] };
    }
    // Production: bundled binary in app resources
    return { command: join(process.resourcesPath, 'syncflow-sidecar'), args: [] };
  }

  async start(): Promise<void> {
    if (this.process) return;

    this.stopping = false;
    this.clearRestartTimer();
    this.stopHealthCheck();

    const { command, args } = this.getSpawnArgs();
    const cwd = is.dev
      ? join(app.getAppPath(), '..', '..', 'services', 'sidecar-go')
      : undefined;
    this.setState({
      status: 'starting',
      message:
        this.restartCount > 0
          ? `后台服务不可用，正在重试（${this.restartCount}/${this.maxRestarts}）`
          : '后台服务启动中…',
    });
    log.info(`[SidecarManager] starting: ${command} ${args.join(' ')}`);

    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, SYNCFLOW_CONFIG: '', CGO_ENABLED: '1' },
    });
    this.process = child;

    child.stdout?.on('data', (data) => {
      try { log.info(`[sidecar] ${data.toString().trim()}`); } catch { /* pipe closed */ }
    });
    child.stderr?.on('data', (data) => {
      try { log.error(`[sidecar] ${data.toString().trim()}`); } catch { /* pipe closed */ }
    });
    child.on('error', (err) => {
      if (this.process !== child) return;
      this.process = null;
      log.error(`[SidecarManager] process error: ${err.message}`);
      this.handleFailure(`后台服务启动失败：${err.message}`, null);
    });

    child.on('exit', (code) => {
      if (this.process !== child) return;
      this.process = null;
      log.warn(`[SidecarManager] process exited with code ${code}`);
      this.handleFailure('后台服务已退出', code);
    });

    try {
      await this.waitForHealth(10, 500);
      this.restartCount = 0;
      this.startHealthCheck();
      this.setState({
        status: 'healthy',
        message: null,
        lastExitCode: null,
      });
      log.info('[SidecarManager] sidecar is healthy');
    } catch (err) {
      log.error('[SidecarManager] health wait failed', err);
      if (this.process === child && !child.killed) {
        child.kill('SIGTERM');
      }
      throw err;
    }
  }

  async retryStart(): Promise<void> {
    this.restartCount = 0;
    this.clearRestartTimer();
    await this.stop();
    await this.start();
  }

  async stop(): Promise<void> {
    this.stopping = true;
    this.clearRestartTimer();
    this.stopHealthCheck();
    if (this.process) {
      log.info('[SidecarManager] stopping sidecar');
      this.process.kill('SIGTERM');
      // Give it 5s to shutdown gracefully
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (this.process) this.process.kill('SIGKILL');
          resolve();
        }, 5000);
        this.process?.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
      this.process = null;
    }
    this.setState({
      status: 'stopped',
      message: null,
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await sidecarClient.getHealth();
      return res.ok === true;
    } catch {
      return false;
    }
  }

  private async waitForHealth(retries: number, intervalMs: number): Promise<void> {
    for (let i = 0; i < retries; i++) {
      if (await this.healthCheck()) return;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error('Sidecar failed to become healthy');
  }

  private startHealthCheck(): void {
    this.stopHealthCheck();
    this.healthInterval = setInterval(async () => {
      const ok = await this.healthCheck();
      if (!ok) {
        log.warn('[SidecarManager] health check failed');
      }
    }, 3000);
  }

  private stopHealthCheck(): void {
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
      this.healthInterval = null;
    }
  }

  private clearRestartTimer(): void {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
  }

  private handleFailure(message: string, code: number | null): void {
    this.stopHealthCheck();

    if (this.stopping) {
      this.setState({
        status: 'stopped',
        message: null,
        lastExitCode: code,
      });
      return;
    }

    if (this.restartCount < this.maxRestarts) {
      this.restartCount += 1;
      this.setState({
        status: 'starting',
        message: `${message}，正在重试（${this.restartCount}/${this.maxRestarts}）`,
        lastExitCode: code,
      });
      log.info(
        `[SidecarManager] restarting (attempt ${this.restartCount}/${this.maxRestarts})`,
      );
      this.clearRestartTimer();
      this.restartTimer = setTimeout(() => {
        this.restartTimer = null;
        void this.start().catch((err) => {
          log.error('[SidecarManager] restart attempt failed', err);
        });
      }, 1000);
      return;
    }

    log.error('[SidecarManager] max restarts exceeded');
    this.setState({
      status: 'failed',
      message: `${message}。请检查 sidecar 可执行文件或点击重试。`,
      lastExitCode: code,
    });
  }

  private setState(patch: Partial<SidecarRuntimeState>): void {
    this.state = {
      ...this.state,
      ...patch,
      restartCount: this.restartCount,
      maxRestarts: this.maxRestarts,
    };
    this.emit('state', this.getState());
  }
}
