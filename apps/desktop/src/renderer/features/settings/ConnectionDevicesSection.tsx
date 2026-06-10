import { useCallback, useEffect } from 'react';
import { RefreshCcw, ShieldOff, Unlock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@renderer/components/ui/button';
import { useConnectionDevicesStore } from '@renderer/stores/connection-devices-store';

function formatDate(value?: string): string {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function formatValue(value?: string): string {
  return value && value.trim().length > 0 ? value : '-';
}

export function ConnectionDevicesSection() {
  const { t } = useTranslation();
  const { data, loading, error, busyClientId, fetchConnectionDevices, revokeDevice, clearBlock } =
    useConnectionDevicesStore();

  useEffect(() => {
    void fetchConnectionDevices();
  }, [fetchConnectionDevices]);

  const handleRevoke = useCallback(
    (clientId: string) => {
      if (window.confirm(t('settings.connectionDevices.confirmRevoke'))) {
        void revokeDevice(clientId);
      }
    },
    [revokeDevice, t],
  );

  const handleClearBlock = useCallback(
    (clientId: string) => {
      if (window.confirm(t('settings.connectionDevices.confirmClearBlock'))) {
        void clearBlock(clientId);
      }
    },
    [clearBlock, t],
  );

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-xs leading-5 text-muted-foreground">
          {t('settings.connectionDevices.description')}
        </p>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={t('settings.connectionDevices.refresh')}
          disabled={loading}
          onClick={() => void fetchConnectionDevices()}
        >
          <RefreshCcw className="h-4 w-4" />
        </Button>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {t('settings.connectionDevices.loadFailed')}: {error}
        </p>
      )}

      <section className="space-y-2">
        <h3 className="text-xs font-semibold text-foreground">
          {t('settings.connectionDevices.authorized')}
        </h3>
        {data.authorizedDevices.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
            {t('settings.connectionDevices.emptyAuthorized')}
          </p>
        ) : (
          <div className="space-y-2">
            {data.authorizedDevices.map((device) => (
              <div key={device.clientId} className="rounded-md border border-border p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {device.displayName}
                    </p>
                    <dl className="grid gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
                      <div className="min-w-0">
                        <dt className="inline text-foreground">
                          {t('settings.connectionDevices.platform')}:{' '}
                        </dt>
                        <dd className="inline break-words">{formatValue(device.platform)}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="inline text-foreground">
                          {t('settings.connectionDevices.ip')}:{' '}
                        </dt>
                        <dd className="inline break-words">{formatValue(device.ip)}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="inline text-foreground">
                          {t('settings.connectionDevices.status')}:{' '}
                        </dt>
                        <dd className="inline break-words">
                          {t(`settings.connectionDevices.${device.status}Status`)}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="inline text-foreground">
                          {t('settings.connectionDevices.authorizedAt')}:{' '}
                        </dt>
                        <dd className="inline break-words">{formatDate(device.authorizedAt)}</dd>
                      </div>
                      <div className="min-w-0 sm:col-span-2">
                        <dt className="inline text-foreground">
                          {t('settings.connectionDevices.lastSeenAt')}:{' '}
                        </dt>
                        <dd className="inline break-words">{formatDate(device.lastSeenAt)}</dd>
                      </div>
                    </dl>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    disabled={busyClientId === device.clientId}
                    onClick={() => handleRevoke(device.clientId)}
                  >
                    <ShieldOff className="h-4 w-4" />
                    {t('settings.connectionDevices.revoke')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold text-foreground">
          {t('settings.connectionDevices.blocked')}
        </h3>
        {data.blockedClients.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
            {t('settings.connectionDevices.emptyBlocked')}
          </p>
        ) : (
          <div className="space-y-2">
            {data.blockedClients.map((client) => (
              <div key={client.clientId} className="rounded-md border border-border p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {client.displayName}
                    </p>
                    <dl className="grid gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
                      <div className="min-w-0">
                        <dt className="inline text-foreground">
                          {t('settings.connectionDevices.platform')}:{' '}
                        </dt>
                        <dd className="inline break-words">{formatValue(client.platform)}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="inline text-foreground">
                          {t('settings.connectionDevices.ip')}:{' '}
                        </dt>
                        <dd className="inline break-words">{formatValue(client.lastIp)}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="inline text-foreground">
                          {t('settings.connectionDevices.failedAttempts')}:{' '}
                        </dt>
                        <dd className="inline break-words">{client.failedAttempts}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="inline text-foreground">
                          {t('settings.connectionDevices.blockedAt')}:{' '}
                        </dt>
                        <dd className="inline break-words">{formatDate(client.blockedAt)}</dd>
                      </div>
                      <div className="min-w-0 sm:col-span-2">
                        <dt className="inline text-foreground">
                          {t('settings.connectionDevices.lastAttemptAt')}:{' '}
                        </dt>
                        <dd className="inline break-words">{formatDate(client.lastAttemptAt)}</dd>
                      </div>
                    </dl>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    disabled={busyClientId === client.clientId}
                    onClick={() => handleClearBlock(client.clientId)}
                  >
                    <Unlock className="h-4 w-4" />
                    {t('settings.connectionDevices.clearBlock')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold text-foreground">
          {t('settings.connectionDevices.recentAttempts')}
        </h3>
        {data.recentAttempts.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
            {t('settings.connectionDevices.emptyAttempts')}
          </p>
        ) : (
          <div className="space-y-2">
            {data.recentAttempts.map((attempt) => (
              <div key={attempt.id} className="rounded-md border border-border p-3">
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {attempt.displayName}
                  </p>
                  <dl className="grid gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
                    <div className="min-w-0">
                      <dt className="inline text-foreground">
                        {t('settings.connectionDevices.platform')}:{' '}
                      </dt>
                      <dd className="inline break-words">{formatValue(attempt.platform)}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="inline text-foreground">
                        {t('settings.connectionDevices.ip')}:{' '}
                      </dt>
                      <dd className="inline break-words">{formatValue(attempt.ip)}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="inline text-foreground">
                        {t('settings.connectionDevices.result')}:{' '}
                      </dt>
                      <dd className="inline break-words">{attempt.result}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="inline text-foreground">
                        {t('settings.connectionDevices.failureReason')}:{' '}
                      </dt>
                      <dd className="inline break-words">
                        {formatValue(attempt.failureReason)}
                      </dd>
                    </div>
                    <div className="min-w-0 sm:col-span-2">
                      <dt className="inline text-foreground">
                        {t('settings.connectionDevices.lastAttemptAt')}:{' '}
                      </dt>
                      <dd className="inline break-words">{formatDate(attempt.createdAt)}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
