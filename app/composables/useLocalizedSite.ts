export function useLocalizedSite(site: Ref<any>) {
  const { t } = useI18n()

  return computed(() => {
    const base = site.value
    if (!base) return null

    return {
      ...base,
      hero: {
        ...base.hero,
        kicker: t('site.hero.kicker'),
        kickerAccent: t('site.hero.kickerAccent'),
        title: [
          { text: t('site.hero.title.0.text') },
          { text: t('site.hero.title.1.text'), em: true },
          { text: t('site.hero.title.2.text') }
        ],
        lead: t('site.hero.lead'),
        meta: [
          t('site.hero.meta.0'),
          t('site.hero.meta.1')
        ]
      },
      history: {
        ...base.history,
        eyebrow: t('site.history.eyebrow'),
        quote: t('site.history.quote'),
        body: [
          t('site.history.body.0'),
          t('site.history.body.1')
        ],
        sinceText: [
          t('site.history.sinceText.0'),
          t('site.history.sinceText.1')
        ]
      },
      about: {
        ...base.about,
        eyebrow: t('site.about.eyebrow'),
        heading: [
          { text: t('site.about.heading.0.text') },
          { text: t('site.about.heading.1.text') },
          { text: t('site.about.heading.2.text'), em: true }
        ],
        body: t('site.about.body'),
        cta: {
          ...base.about.cta,
          label: t('site.about.ctaLabel')
        }
      },
      footer: {
        ...base.footer,
        tagline: t('site.footer.tagline'),
        columns: [
          {
            title: t('site.footer.columns.0.title'),
            links: [
              { label: t('site.footer.columns.0.links.0.label'), to: '/albums' },
              { label: t('site.footer.columns.0.links.1.label'), to: '/#stories' },
              { label: t('site.footer.columns.0.links.2.label'), to: '/#history' },
              { label: t('site.footer.columns.0.links.3.label'), to: '/#about' },
              { label: t('site.footer.columns.0.links.4.label'), to: '/#about' },
              { label: t('site.footer.columns.0.links.5.label'), to: '#' }
            ]
          },
          {
            title: t('site.footer.columns.1.title'),
            links: [
              { label: t('site.footer.columns.1.links.0.label'), to: '#' },
              { label: t('site.footer.columns.1.links.1.label'), to: '#' },
              { label: t('site.footer.columns.1.links.2.label'), to: '#' }
            ]
          }
        ],
        copyright: t('site.footer.copyright'),
        location: t('site.footer.location')
      }
    }
  })
}
