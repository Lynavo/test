export type SidecarRuntimeStatus = 'starting' | 'healthy' | 'failed' | 'stopped';

export interface SidecarRuntimeState {
  status: SidecarRuntimeStatus;
  message: string | null;
  restartCount: number;
  maxRestarts: number;
  lastExitCode: number | null;
}

export const INITIAL_SIDECAR_RUNTIME_STATE: SidecarRuntimeState = {
  status: 'starting',
  message: '后台服务启动中…',
  restartCount: 0,
  maxRestarts: 3,
  lastExitCode: null,
};
