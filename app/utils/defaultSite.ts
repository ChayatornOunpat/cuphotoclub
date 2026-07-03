export const defaultSite = {
  nav: {
    links: [
      { label: 'Home', to: '/' },
      { label: 'Albums', to: '/albums' },
      { label: 'Blog', to: '/#stories' },
      { label: 'Activities', to: '/activities' },
      { label: 'Members', to: '/members' },
      { label: 'About', to: '/#about' },
      { label: 'Join', to: '/#about', join: true }
    ]
  },
  hero: {
    kicker: 'Chulalongkorn University · ',
    kickerAccent: 'Est. 1967',
    title: [
      { text: 'Through' },
      { text: 'the lens', em: true },
      { text: 'we see' }
    ],
    image: '/club-icon.jpg',
    lead: 'The official photography club of Chulalongkorn University - documenting life, culture, and the human condition since 1967.',
    meta: ['Photography · Community', 'Bangkok, Thailand']
  },
  history: {
    eyebrow: 'Our History',
    image: '/club-icon.jpg',
    quote: 'Every photograph we make is a letter to the future.',
    body: [
      "Founded in 1967 by a small group of Chulalongkorn University students with borrowed cameras and a shared obsession with the image, the CU Photo Club has grown into one of Thailand's most respected student photography organisations.",
      'Over five decades, we have documented student life, cultural shifts, and the evolving cityscape of Bangkok - building an archive that is both personal record and historical testimony.'
    ],
    sinceNum: '1967',
    sinceText: ['Year founded', 'Bangkok, Thailand']
  },
  about: {
    eyebrow: 'About Us',
    heading: [
      { text: 'A community' },
      { text: 'that ' },
      { text: 'sees', em: true }
    ],
    body: 'CU Photo Club is open to all students of Chulalongkorn University regardless of experience level. We meet weekly, run workshops, hold annual exhibitions, and maintain an active archive of visual work from across the decades. If you have curiosity and a camera, you belong here.',
    cta: { label: 'Join the Club', to: '#' },
    image: '/club-icon.jpg'
  },
  footer: {
    tagline: 'Official photography club of\nChulalongkorn University, Bangkok, Thailand',
    columns: [
      {
        title: 'Navigate',
        links: [
          { label: 'Albums', to: '/albums' },
          { label: 'Blog', to: '/#stories' },
          { label: 'History', to: '/#history' },
          { label: 'About', to: '/#about' },
          { label: 'Join', to: '/#about' },
          { label: 'Contact', to: '#' }
        ]
      },
      {
        title: 'Follow',
        links: [
          { label: 'Instagram', to: '#' },
          { label: 'Facebook', to: '#' },
          { label: 'YouTube', to: '#' }
        ]
      }
    ],
    copyright: '(c) 2025 CU Photo Club, Chulalongkorn University',
    location: 'Bangkok, Thailand'
  }
}

