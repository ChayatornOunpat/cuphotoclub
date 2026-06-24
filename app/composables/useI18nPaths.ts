function localeCodes(locales: unknown): string[] {
  return (Array.isArray(locales) ? locales : [])
    .map(locale => typeof locale === 'string' ? locale : (locale as { code?: string })?.code)
    .filter((code): code is string => Boolean(code))
}

export function useContentRoutePath() {
  const route = useRoute()
  const { locales } = useI18n()

  return computed(() => {
    const path = route.path.replace(/\/+$/, '') || '/'
    const [, maybeLocale, ...rest] = path.split('/')

    if (maybeLocale && localeCodes(locales.value).includes(maybeLocale)) {
      return rest.length ? `/${rest.join('/')}` : '/'
    }

    return path
  })
}

export function useLocalizedContentPath() {
  const localePath = useLocalePath()
  return (path: string) => localePath(path || '/')
}
