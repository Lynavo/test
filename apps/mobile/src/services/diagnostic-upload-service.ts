import { authHeaders, buildUrl } from './api';

export type UploadProgress = (loaded: number, total: number) => void;

export interface UploadResult {
  refId: string;
  uploadedAt: string;
}

export type UploadError =
  | { kind: 'BUNDLE_TOO_LARGE' }
  | { kind: 'ABORTED' }
  | { kind: 'NETWORK_ERROR' }
  | { kind: 'SERVER_ERROR'; status: number; body?: string };

export class DiagnosticUploadError extends Error {
  readonly detail: UploadError;
  constructor(detail: UploadError) {
    const msg =
      detail.kind === 'SERVER_ERROR'
        ? `server error ${detail.status}`
        : detail.kind;
    super(msg);
    this.detail = detail;
    this.name = 'DiagnosticUploadError';
  }
}

export interface DiagnosticUploadService {
  upload(
    zipBlob: Blob,
    clientId: string,
    signal: AbortSignal,
    onProgress?: UploadProgress,
  ): Promise<UploadResult>;
}

class XHRDiagnosticUploadService implements DiagnosticUploadService {
  upload(
    zipBlob: Blob,
    clientId: string,
    signal: AbortSignal,
    onProgress?: UploadProgress,
  ): Promise<UploadResult> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', buildUrl('/diagnostics/upload'));

      const headers = authHeaders();
      // Don't set Content-Type — browser/RN sets multipart boundary itself.
      Object.entries(headers).forEach(([k, v]) =>
        xhr.setRequestHeader(k, v),
      );

      if (onProgress) {
        xhr.upload.onprogress = (e: ProgressEvent) => {
          if (e.lengthComputable) onProgress(e.loaded, e.total);
        };
      }

      let aborted = false;
      const onAbort = () => {
        aborted = true;
        try {
          xhr.abort();
        } catch {
          // noop
        }
        reject(new DiagnosticUploadError({ kind: 'ABORTED' }));
      };
      signal.addEventListener('abort', onAbort);

      const cleanup = () => signal.removeEventListener('abort', onAbort);

      xhr.onload = () => {
        cleanup();
        if (aborted) return;
        if (xhr.status === 200) {
          try {
            const parsed = JSON.parse(xhr.responseText) as {
              ref_id: string;
              uploaded_at: string;
            };
            resolve({ refId: parsed.ref_id, uploadedAt: parsed.uploaded_at });
          } catch {
            reject(
              new DiagnosticUploadError({
                kind: 'SERVER_ERROR',
                status: 200,
                body: xhr.responseText,
              }),
            );
          }
        } else if (xhr.status === 413) {
          reject(new DiagnosticUploadError({ kind: 'BUNDLE_TOO_LARGE' }));
        } else {
          reject(
            new DiagnosticUploadError({
              kind: 'SERVER_ERROR',
              status: xhr.status,
              body: xhr.responseText,
            }),
          );
        }
      };

      xhr.onerror = () => {
        cleanup();
        if (aborted) return;
        reject(new DiagnosticUploadError({ kind: 'NETWORK_ERROR' }));
      };

      const form = new FormData();
      form.append('client_id', clientId);
      // RN's FormData TS definition only exposes a 2-arg append(name, value).
      // Pass the Blob-like descriptor object that RN's native FormData handles:
      // {uri, type, name} for file-backed blobs. For an in-memory Blob we cast
      // to the RN-compatible shape so the multipart part gets a filename header.
      const bundleDescriptor = {
        uri: '',
        type: 'application/zip',
        name: `diagnostics-${Date.now()}.zip`,
        // Attach the actual data via a non-standard property that RN's
        // FormData polyfill surfaces to the native layer when uri is empty.
        blob: zipBlob,
      };
      form.append('bundle', bundleDescriptor as unknown as string);
      xhr.send(form as unknown as Document);
    });
  }
}

export const diagnosticUploadService: DiagnosticUploadService =
  new XHRDiagnosticUploadService();
