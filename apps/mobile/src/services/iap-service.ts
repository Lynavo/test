import {
  initConnection,
  endConnection,
  purchaseUpdatedListener,
  purchaseErrorListener,
  requestSubscription,
  finishTransaction as rnFinishTransaction,
  getAvailablePurchases,
  getSubscriptions,
  type Purchase,
  type PurchaseError,
} from 'react-native-iap';
import { type EmitterSubscription } from 'react-native';
import { type IapProductId, productIdToPlan, TRIAL_ELIGIBLE_PRODUCTS } from '../constants/iap';
import { verifyIapReceipt } from './subscription-service';
import { ApiError, ERROR_CODE } from './api';

const MAX_RESTORE_RECEIPTS = 10;

export interface PurchaseReceipt {
  transactionReceipt: string;
  productId: IapProductId;
  transactionId: string;
}

export interface EligibilityResult {
  productId: IapProductId;
  eligibleForIntroOffer: boolean;
}

export interface IapService {
  initialize(): Promise<void>;
  teardown(): Promise<void>;
  purchase(productId: IapProductId): Promise<PurchaseReceipt>;
  restore(): Promise<PurchaseReceipt[]>;
  finishTransaction(transactionId: string): Promise<void>;
  checkEligibility(): Promise<EligibilityResult[]>;
  onOrphanPurchaseVerified(cb: () => void): () => void;
}

class IapServiceImpl implements IapService {
  private initialized = false;
  private purchaseSub: EmitterSubscription | null = null;
  private errorSub: EmitterSubscription | null = null;
  private pendingPurchase = new Map<
    IapProductId,
    {
      resolve: (r: PurchaseReceipt) => void;
      reject: (err: unknown) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  >();
  private orphanListeners = new Set<() => void>();

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await initConnection();
    this.purchaseSub = purchaseUpdatedListener((p) => {
      void this.handlePurchaseEvent(p);
    });
    this.errorSub = purchaseErrorListener((err) => {
      this.handleErrorEvent(err);
    });
    this.initialized = true;
  }

  async teardown(): Promise<void> {
    if (!this.initialized) return;
    this.purchaseSub?.remove();
    this.errorSub?.remove();
    this.purchaseSub = null;
    this.errorSub = null;
    await endConnection();
    this.initialized = false;
  }

  async purchase(productId: IapProductId): Promise<PurchaseReceipt> {
    if (!this.initialized) {
      throw new Error('iapService.initialize() must be called before purchase()');
    }
    if (this.pendingPurchase.has(productId)) {
      throw new Error(`purchase already in flight for ${productId}`);
    }
    return new Promise<PurchaseReceipt>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingPurchase.delete(productId);
        reject(new Error('purchase timed out after 60s'));
      }, 60_000);
      this.pendingPurchase.set(productId, { resolve, reject, timeout });
      void Promise.resolve(requestSubscription({ sku: productId })).catch((err) => {
        const entry = this.pendingPurchase.get(productId);
        if (!entry) return;
        clearTimeout(entry.timeout);
        this.pendingPurchase.delete(productId);
        reject(err);
      });
    });
  }

  async restore(): Promise<PurchaseReceipt[]> {
    if (!this.initialized) {
      throw new Error('iapService.initialize() must be called before restore()');
    }
    const purchases = await getAvailablePurchases();
    const slice = purchases.slice(0, MAX_RESTORE_RECEIPTS);
    const out: PurchaseReceipt[] = [];

    for (const p of slice) {
      if (!p.transactionReceipt) continue;
      const plan = productIdToPlan(p.productId);
      if (!plan) continue;
      const txId = p.transactionId ?? '';

      try {
        await verifyIapReceipt(p.transactionReceipt, plan);
        await this.finishTransaction(txId).catch(() => {});
        out.push({
          productId: p.productId as IapProductId,
          transactionReceipt: p.transactionReceipt,
          transactionId: txId,
        });
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.code === ERROR_CODE.RECEIPT_ALREADY_USED) {
            await this.finishTransaction(txId).catch(() => {});
            out.push({
              productId: p.productId as IapProductId,
              transactionReceipt: p.transactionReceipt,
              transactionId: txId,
            });
            continue;
          }
          if (err.code === ERROR_CODE.PRODUCT_ID_MISMATCH) {
            continue;
          }
        }
        // Other errors: skip, do not finish — next launch may retry via orphan.
      }
    }
    return out;
  }
  async finishTransaction(transactionId: string): Promise<void> {
    // react-native-iap v12 accepts either a Purchase object or transactionId
    // via `purchase`; we keep a minimal stub shape it understands.
    await rnFinishTransaction({
      purchase: { transactionId } as Purchase,
      isConsumable: false,
    });
  }
  async checkEligibility(): Promise<EligibilityResult[]> {
    if (!this.initialized) return [];
    if (TRIAL_ELIGIBLE_PRODUCTS.length === 0) return [];
    try {
      const products = await getSubscriptions({
        skus: [...TRIAL_ELIGIBLE_PRODUCTS],
      });
      return TRIAL_ELIGIBLE_PRODUCTS.map((productId) => {
        const match = products.find((p) => p.productId === productId);
        const eligible =
          match != null &&
          'introductoryPricePaymentModeIOS' in match &&
          match.introductoryPricePaymentModeIOS === 'FREETRIAL';
        return { productId, eligibleForIntroOffer: eligible };
      });
    } catch {
      // Eligibility query failure must not block UI — fall back to "not eligible"
      // so the non-trial copy is shown (never over-promise a free trial).
      return [];
    }
  }
  onOrphanPurchaseVerified(cb: () => void): () => void {
    this.orphanListeners.add(cb);
    return () => this.orphanListeners.delete(cb);
  }

  private async handlePurchaseEvent(p: Purchase): Promise<void> {
    const productId = p.productId as IapProductId;
    const pending = this.pendingPurchase.get(productId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingPurchase.delete(productId);
      pending.resolve({
        productId,
        transactionReceipt: p.transactionReceipt,
        transactionId: p.transactionId ?? '',
      });
      return;
    }
    // Orphan — Task 6 handles this.
    await this.handleOrphanPurchase(p);
  }

  private handleErrorEvent(err: PurchaseError): void {
    const productId = err.productId as IapProductId | undefined;
    if (!productId) return;
    const pending = this.pendingPurchase.get(productId);
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.pendingPurchase.delete(productId);
    pending.reject(err);
  }

  private async handleOrphanPurchase(p: Purchase): Promise<void> {
    const productId = p.productId;
    const txId = p.transactionId ?? '';
    const plan = productIdToPlan(productId);
    if (!plan) {
      // Unknown product — finish to unjam the queue but do not notify.
      await this.finishTransaction(txId).catch(() => {});
      return;
    }
    try {
      await verifyIapReceipt(p.transactionReceipt, plan);
      await this.finishTransaction(txId).catch(() => {});
      this.orphanListeners.forEach((cb) => cb());
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === ERROR_CODE.RECEIPT_ALREADY_USED) {
          await this.finishTransaction(txId).catch(() => {});
          this.orphanListeners.forEach((cb) => cb());
          return;
        }
        if (err.code === ERROR_CODE.PRODUCT_ID_MISMATCH) {
          await this.finishTransaction(txId).catch(() => {});
          return;
        }
      }
      // Network / 5xx / 2001 — leave the transaction unfinished so Apple
      // redelivers it on next startup.
    }
  }
}

export const iapService: IapService = new IapServiceImpl();
