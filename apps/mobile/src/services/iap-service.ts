import {
  initConnection,
  endConnection,
  purchaseUpdatedListener,
  purchaseErrorListener,
  type Purchase,
  type PurchaseError,
} from 'react-native-iap';
import { type EmitterSubscription } from 'react-native';
import { type IapProductId } from '../constants/iap';

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

  // Stubs filled in by later tasks.
  async purchase(_productId: IapProductId): Promise<PurchaseReceipt> {
    throw new Error('purchase() not implemented yet');
  }
  async restore(): Promise<PurchaseReceipt[]> {
    throw new Error('restore() not implemented yet');
  }
  async finishTransaction(_transactionId: string): Promise<void> {
    throw new Error('finishTransaction() not implemented yet');
  }
  async checkEligibility(): Promise<EligibilityResult[]> {
    throw new Error('checkEligibility() not implemented yet');
  }
  onOrphanPurchaseVerified(_cb: () => void): () => void {
    throw new Error('onOrphanPurchaseVerified() not implemented yet');
  }

  private async handlePurchaseEvent(_p: Purchase): Promise<void> {
    // Filled in by Tasks 5 and 6.
  }

  private handleErrorEvent(_err: PurchaseError): void {
    // Filled in by Task 5.
  }
}

export const iapService: IapService = new IapServiceImpl();
