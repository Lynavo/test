import { useEffect } from 'react';
import { iapService } from '../services/iap-service';
import { FEATURES } from '../constants/features';

export interface UseIapLifecycleArgs {
  isLoggedIn: boolean;
  loadSubscription: () => Promise<void>;
}

export function useIapLifecycle({
  isLoggedIn,
  loadSubscription,
}: UseIapLifecycleArgs): void {
  useEffect(() => {
    if (!FEATURES.IAP_ENABLED) return;
    if (!isLoggedIn) return;

    // Register orphan listener synchronously so teardown can unsubscribe
    // even if initialize() hasn't resolved yet.
    const unsubscribe = iapService.onOrphanPurchaseVerified(() => {
      void loadSubscription();
    });

    void iapService.initialize();

    return () => {
      unsubscribe();
      void iapService.teardown();
    };
  }, [isLoggedIn, loadSubscription]);
}
