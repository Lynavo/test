import { useCallback, useEffect, useState } from 'react';
import { Moon, Wifi } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { PowerSaveState } from '../../../preload/api';
import { useElectronAPI } from '../../hooks/use-electron-api';
import { cn } from '../../lib/utils';

export function PowerSaveSection() {
  const { t } = useTranslation();
  const api = useElectronAPI();
  const [state, setState] = useState<PowerSaveState | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const refreshState = useCallback(
    async (showLoadError: boolean): Promise<PowerSaveState | null> => {
      try {
        return await api.power.getState();
      } catch {
        if (showLoadError) {
          toast.error(t('errors.settings.powerSaveLoadFailed'));
        }
        return null;
      }
    },
    [api.power, t],
  );

  useEffect(() => {
    let active = true;

    refreshState(true)
      .then((nextState) => {
        if (active && nextState) {
          setState(nextState);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [refreshState]);

  useEffect(() => {
    let active = true;

    const unsubscribe = api.events.onSidecarEvent((event) => {
      if (!active || event.type !== 'transfer.active.changed') {
        return;
      }
      void refreshState(false).then((nextState) => {
        if (active && nextState) {
          setState(nextState);
        }
      });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [api.events, refreshState]);

  const enabled = state?.preventSleepDuringTransfer ?? false;
  const blockingSleep = state?.blockingSleep ?? false;

  const handleToggle = useCallback(async () => {
    if (loading || updating) return;

    setUpdating(true);
    try {
      const nextState = await api.power.setPreventSleepDuringTransfer(!enabled);
      setState(nextState);
    } catch {
      toast.error(t('errors.settings.powerSaveUpdateFailed'));
    } finally {
      setUpdating(false);
    }
  }, [api.power, enabled, loading, t, updating]);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Moon className="h-4 w-4 text-sky-600" />
            {t('settings.powerSave.preventSleepTitle')}
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {t('settings.powerSave.preventSleepDescription')}
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            <Wifi className="h-3.5 w-3.5" />
            {blockingSleep ? t('settings.powerSave.blockingSleep') : t('settings.powerSave.idle')}
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={t('settings.powerSave.preventSleepTitle')}
          disabled={loading || updating}
          onClick={() => void handleToggle()}
          className={cn(
            'relative h-7 w-12 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
            enabled ? 'border-sky-500 bg-sky-500' : 'border-border bg-muted',
          )}
        >
          <span
            data-testid="power-save-switch-thumb"
            className={cn(
              'absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
              enabled ? 'translate-x-[18px]' : 'translate-x-0',
            )}
          />
        </button>
      </div>
    </div>
  );
}
