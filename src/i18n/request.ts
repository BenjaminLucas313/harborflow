// next-intl v4 request configuration.
//
// Without i18n routing: locale defaults to 'es'.
// When URL-based routing is added later (e.g. /es/... /en/...),
// requestLocale will carry the matched [locale] segment value and the
// default fallback below becomes the only change needed here.
import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = (await requestLocale) ?? "es";

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
