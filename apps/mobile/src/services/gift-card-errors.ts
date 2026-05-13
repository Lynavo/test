export type GiftCardRedeemFailureTranslationKey =
  | 'settings.giftCard.failure.body'
  | 'settings.giftCard.failure.invalidCode'
  | 'settings.giftCard.failure.expired'
  | 'settings.giftCard.failure.notAvailable'
  | 'settings.giftCard.failure.alreadyRedeemed'
  | 'settings.giftCard.failure.planMismatch'
  | 'settings.giftCard.failure.invalidOperation'
  | 'settings.giftCard.failure.activeSubscription'
  | 'settings.giftCard.failure.network';

const GIFT_CARD_FAILURE_KEY_BY_CODE: Record<
  number,
  GiftCardRedeemFailureTranslationKey
> = {
  3001: 'settings.giftCard.failure.invalidCode',
  3002: 'settings.giftCard.failure.expired',
  3003: 'settings.giftCard.failure.notAvailable',
  3004: 'settings.giftCard.failure.alreadyRedeemed',
  3005: 'settings.giftCard.failure.planMismatch',
  3006: 'settings.giftCard.failure.invalidOperation',
  3007: 'settings.giftCard.failure.activeSubscription',
  9004: 'settings.giftCard.failure.network',
};

const GIFT_CARD_FAILURE_KEY_BY_MESSAGE: Array<{
  match: string[];
  key: GiftCardRedeemFailureTranslationKey;
}> = [
  {
    match: ['禮品卡碼無效', '礼品卡码无效', '禮品卡代碼無效', '礼品卡代码无效'],
    key: 'settings.giftCard.failure.invalidCode',
  },
  {
    match: ['禮品卡已過期', '礼品卡已过期'],
    key: 'settings.giftCard.failure.expired',
  },
  {
    match: ['禮品卡已停止使用或已用完', '礼品卡已停止使用或已用完'],
    key: 'settings.giftCard.failure.notAvailable',
  },
  {
    match: ['此帳號已兌換過此禮品卡', '此账号已兑换过此礼品卡'],
    key: 'settings.giftCard.failure.alreadyRedeemed',
  },
  {
    match: ['禮品卡方案無法套用', '礼品卡方案无法套用'],
    key: 'settings.giftCard.failure.planMismatch',
  },
  {
    match: ['禮品卡操作參數不合法', '礼品卡操作参数不合法'],
    key: 'settings.giftCard.failure.invalidOperation',
  },
  {
    match: ['已有訂閱會員，無法使用禮品卡', '已有订阅会员，无法使用礼品卡'],
    key: 'settings.giftCard.failure.activeSubscription',
  },
];

function readErrorCode(error: unknown): number | null {
  if (error === null || typeof error !== 'object' || !('code' in error)) {
    return null;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === 'number' ? code : null;
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (error === null || typeof error !== 'object' || !('message' in error)) {
    return '';
  }
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : '';
}

export function getGiftCardRedeemFailureTranslationKey(
  error: unknown,
): GiftCardRedeemFailureTranslationKey {
  const code = readErrorCode(error);
  if (code !== null && GIFT_CARD_FAILURE_KEY_BY_CODE[code]) {
    return GIFT_CARD_FAILURE_KEY_BY_CODE[code];
  }

  const message = readErrorMessage(error);
  const messageMatch = GIFT_CARD_FAILURE_KEY_BY_MESSAGE.find(({ match }) =>
    match.some(candidate => message.includes(candidate)),
  );
  return messageMatch?.key ?? 'settings.giftCard.failure.body';
}
