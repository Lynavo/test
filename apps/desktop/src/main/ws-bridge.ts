import WebSocket from 'ws';
import { BrowserWindow } from 'electron';
import log from 'electron-log';
import { SIDECAR_HTTP_PORT } from '@syncflow/contracts';

export class WsBridge {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manualDisconnect = false;

  constructor(private getWindow: () => BrowserWindow | null) {}

  connect(): void {
    this.manualDisconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const url = `ws://127.0.0.1:${SIDECAR_HTTP_PORT}/events/stream`;
    log.info(`[WsBridge] connecting to ${url}`);

    const ws = new WebSocket(url);
    this.ws = ws;

    ws.on('open', () => {
      if (this.ws !== ws) {
        return;
      }
      log.info('[WsBridge] connected');
    });

    ws.on('message', (data) => {
      if (this.ws !== ws) {
        return;
      }
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

    ws.on('close', () => {
      const wasManualDisconnect = this.manualDisconnect;
      if (this.ws === ws) {
        this.ws = null;
      }

      if (wasManualDisconnect) {
        log.info('[WsBridge] disconnected');
        return;
      }

      log.info('[WsBridge] disconnected, reconnecting in 3s');
      this.scheduleReconnect();
    });

    ws.on('error', (err) => {
      if (this.ws !== ws) {
        return;
      }
      log.warn('[WsBridge] error', err.message);
    });
  }

  disconnect(): void {
    this.manualDisconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      const ws = this.ws;
      this.ws = null;
      ws.close();
    }
  }

  private scheduleReconnect(): void {
    if (this.manualDisconnect || this.reconnectTimer) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.manualDisconnect) {
        return;
      }
      this.connect();
    }, 3000);
  }
}
