import { DEFAULT_LOCALE, isSupportedLocale } from '@/i18n/config';
import { enUS } from '@/i18n/messages/en-US';
import { zhCN } from '@/i18n/messages/zh-CN';
import type { Dictionary } from '@/i18n/types';
import type { SupportedLocale } from '@/server/shared/platform/domain';

export async function getDictionary(locale: string | SupportedLocale): Promise<Dictionary> {
  if (!isSupportedLocale(locale)) {
    return DEFAULT_LOCALE === 'en-US' ? enUS : zhCN;
  }

  return locale === 'en-US' ? enUS : zhCN;
}
