import WebSocket from 'ws';
import { BrowserWindow } from 'electron';
import log from 'electron-log';
import { SIDECAR_HTTP_PORT } from '@syncflow/contracts';

export class WsBridge {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private getWindow: () => BrowserWindow | null) {}

  connect(): void {
    const url = `ws://127.0.0.1:${SIDECAR_HTTP_PORT}/events/stream`;
    log.info(`[WsBridge] connecting to ${url}`);

    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      log.info('[WsBridge] connected');
    });

    this.ws.on('message', (data) => {
      try {
        const event = JSON.parse(data.toString());
        const win = this.getWindow();
        if (win && !win.isDestroyed()) {
          win.webContents.send('sidecar:event', event);
        }
      } catch (err) {
        log.warn('[WsBridge] failed to parse event', err);
      }
    });

    this.ws.on('close', () => {
      log.info('[WsBridge] disconnected, reconnecting in 3s');
      this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      log.warn('[WsBridge] error', err.message);
    });
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private scheduleReconnect(): void {
    this.reconnectTimer = setTimeout(() => this.connect(), 3000);
  }
}
