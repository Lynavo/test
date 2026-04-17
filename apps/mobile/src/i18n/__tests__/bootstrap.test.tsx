import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { I18nextProvider, useTranslation } from 'react-i18next';

// Mock react-native-localize so `i18n/index.ts` module-load doesn't touch native.
jest.mock('react-native-localize', () => ({
  getLocales: () => [
    { languageCode: 'zh', scriptCode: 'Hans', countryCode: 'CN', languageTag: 'zh-Hans-CN', isRTL: false },
  ],
  findBestLanguageTag: () => ({ languageTag: 'zh-Hans-CN', isRTL: false }),
}));

import i18n from '../index';

function Demo() {
  const { t } = useTranslation();
  return <Text testID="demo">{t('common.ok')}</Text>;
}

describe('i18n bootstrap', () => {
  afterEach(async () => {
    await i18n.changeLanguage('zh');
  });

  it('renders the Chinese label when language is zh', async () => {
    await i18n.changeLanguage('zh');
    const { getByTestId } = render(
      <I18nextProvider i18n={i18n}>
        <Demo />
      </I18nextProvider>,
    );
    expect(getByTestId('demo').props.children).toBe('好');
  });

  it('renders the English label when language is en', async () => {
    await i18n.changeLanguage('en');
    const { getByTestId } = render(
      <I18nextProvider i18n={i18n}>
        <Demo />
      </I18nextProvider>,
    );
    expect(getByTestId('demo').props.children).toBe('OK');
  });

  it('falls back to English when the key does not exist in zh', async () => {
    await i18n.changeLanguage('zh');
    i18n.addResource('zh', 'translation', 'common.madeUp', undefined as unknown as string);
    i18n.addResource('en', 'translation', 'common.madeUp', 'Made up');
    const { getByTestId } = render(
      <I18nextProvider i18n={i18n}>
        <Text testID="demo">{i18n.t('common.madeUp' as never)}</Text>
      </I18nextProvider>,
    );
    expect(getByTestId('demo').props.children).toBe('Made up');
  });
});
