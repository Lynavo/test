import {
  initConnection,
  endConnection,
  purchaseUpdatedListener,
  purchaseErrorListener,
} from 'react-native-iap';

jest.mock('react-native-iap', () => ({
  initConnection: jest.fn().mockResolvedValue(true),
  endConnection: jest.fn().mockResolvedValue(undefined),
  purchaseUpdatedListener: jest.fn(() => ({ remove: jest.fn() })),
  purchaseErrorListener: jest.fn(() => ({ remove: jest.fn() })),
  getAvailablePurchases: jest.fn().mockResolvedValue([]),
  getSubscriptions: jest.fn().mockResolvedValue([]),
  requestSubscription: jest.fn(),
  finishTransaction: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../subscription-service', () => ({
  verifyIapReceipt: jest.fn().mockResolvedValue(undefined),
  getSubscriptionStatus: jest.fn(),
}));

import { iapService } from '../iap-service';

describe('iapService — lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await iapService.teardown();
  });

  test('initialize() calls initConnection and mounts listeners', async () => {
    await iapService.initialize();

    expect(initConnection).toHaveBeenCalledTimes(1);
    expect(purchaseUpdatedListener).toHaveBeenCalledTimes(1);
    expect(purchaseErrorListener).toHaveBeenCalledTimes(1);
  });

  test('initialize() is idempotent — second call is a no-op', async () => {
    await iapService.initialize();
    await iapService.initialize();

    expect(initConnection).toHaveBeenCalledTimes(1);
    expect(purchaseUpdatedListener).toHaveBeenCalledTimes(1);
  });

  test('teardown() removes listeners and ends connection', async () => {
    const removeMock = jest.fn();
    (purchaseUpdatedListener as jest.Mock).mockReturnValue({ remove: removeMock });
    (purchaseErrorListener as jest.Mock).mockReturnValue({ remove: removeMock });

    await iapService.initialize();
    await iapService.teardown();

    expect(removeMock).toHaveBeenCalledTimes(2);
    expect(endConnection).toHaveBeenCalledTimes(1);
  });

  test('teardown() without initialize() is a no-op', async () => {
    await iapService.teardown();
    expect(endConnection).not.toHaveBeenCalled();
  });
});
