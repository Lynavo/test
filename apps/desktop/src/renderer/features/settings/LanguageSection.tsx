import { Globe2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select';
import { persistLocale } from '@renderer/i18n';
import {
  isSupportedLocale,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from '@renderer/i18n/locale-resolver';

const localeLabelKeys: Record<SupportedLocale, string> = {
  en: 'settings.language.options.en',
  'zh-Hans': 'settings.language.options.zhHans',
  'zh-Hant': 'settings.language.options.zhHant',
};

export function LanguageSection() {
  const { t, i18n } = useTranslation();
  const currentLocale = isSupportedLocale(i18n.resolvedLanguage)
    ? i18n.resolvedLanguage
    : 'en';

  const handleLanguageChange = (value: string) => {
    if (!isSupportedLocale(value)) return;
    persistLocale(value);
    void i18n.changeLanguage(value);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
            <Globe2 className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {t('settings.language.label')}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t('settings.sections.languageDescription')}
            </p>
          </div>
        </div>

        <Select value={currentLocale} onValueChange={handleLanguageChange}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_LOCALES.map((locale) => (
              <SelectItem key={locale} value={locale}>
                {t(localeLabelKeys[locale])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
