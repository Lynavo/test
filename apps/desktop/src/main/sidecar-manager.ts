import { log } from 'console';

export class SidecarManager {
  async start(): Promise<void> {
    log('[SidecarManager] start (stub)');
  }

  async stop(): Promise<void> {
    log('[SidecarManager] stop (stub)');
  }

  async healthCheck(): Promise<{ ok: boolean }> {
    return { ok: true };
  }
}
