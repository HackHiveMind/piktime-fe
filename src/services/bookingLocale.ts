export function getBookingLocale(): 'ro' | 'en' | 'ru' {
  const languages = typeof navigator === 'undefined' ? [] : navigator.languages?.length
    ? navigator.languages : [navigator.language]
  for (const language of languages) {
    const locale = language.toLowerCase().split(/[-_]/)[0]
    if (locale === 'ro' || locale === 'en' || locale === 'ru') return locale
  }
  return 'ro'
}
