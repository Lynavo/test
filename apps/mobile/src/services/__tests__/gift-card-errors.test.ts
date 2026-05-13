import { getGiftCardRedeemFailureTranslationKey } from '../gift-card-errors';

describe('gift card redeem error localization', () => {
  it.each([
    [3001, 'settings.giftCard.failure.invalidCode'],
    [3002, 'settings.giftCard.failure.expired'],
    [3003, 'settings.giftCard.failure.notAvailable'],
    [3004, 'settings.giftCard.failure.alreadyRedeemed'],
    [3005, 'settings.giftCard.failure.planMismatch'],
    [3006, 'settings.giftCard.failure.invalidOperation'],
    [3007, 'settings.giftCard.failure.activeSubscription'],
  ])('maps backend code %s to %s', (code, expectedKey) => {
    expect(
      getGiftCardRedeemFailureTranslationKey(
        Object.assign(new Error('server message'), { code }),
      ),
    ).toBe(expectedKey);
  });

  it('maps legacy server messages when the code is missing', () => {
    expect(
      getGiftCardRedeemFailureTranslationKey(
        new Error('此账号已兑换过此礼品卡'),
      ),
    ).toBe('settings.giftCard.failure.alreadyRedeemed');
  });

  it('falls back to the generic localized message for unknown errors', () => {
    expect(getGiftCardRedeemFailureTranslationKey(new Error('unknown'))).toBe(
      'settings.giftCard.failure.body',
    );
  });
});
