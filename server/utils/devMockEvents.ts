// Dev-only mock activities so `pnpm dev` has calendar data without seeding D1.
// Served by the public events endpoints only when the DB has no published
// events and the server runs in dev mode — production never sees these.
// Dates are relative to "now" so the current calendar month is always populated.

interface MockEvent {
  id: number
  slug: string
  title: string
  summary: string | null
  coverR2Key: string | null
  eventDate: Date | null
  endDate: Date | null
  location: string | null
  registerUrl: string | null
  publishedAt: Date
  body: string
}

function utcDay(monthOffset: number, day: number) {
  const now = new Date()
  return new Date(Date.UTC(now.getFullYear(), now.getMonth() + monthOffset, day))
}

const MOCK_BODY = `ร่วมกิจกรรมกับชมรมถ่ายภาพ สหจุฬาฯ

- พบกันที่จุดนัดหมาย 15 นาทีก่อนเริ่มกิจกรรม
- นำกล้องส่วนตัวมาได้ทุกชนิด ฟิล์มหรือดิจิทัล
- มีพี่ ๆ คอยให้คำแนะนำตลอดกิจกรรม

*This is mock content for local development.*`

export function devMockEvents(): MockEvent[] {
  const published = utcDay(-1, 1)
  return [
    {
      id: 9001,
      slug: 'mock-golden-hour-photowalk',
      title: 'Golden Hour Photowalk',
      summary: 'An evening walk along the Chao Phraya, chasing the last light with any camera you own.',
      coverR2Key: null,
      eventDate: utcDay(0, 8),
      endDate: null,
      location: 'Chao Phraya Riverside',
      registerUrl: 'https://example.com/register',
      publishedAt: published,
      body: MOCK_BODY
    },
    {
      id: 9002,
      slug: 'mock-gear-swap-meet',
      title: 'Camera Gear Swap Meet',
      summary: 'Trade lenses, film stock, and stories with fellow members before the photowalk.',
      coverR2Key: null,
      eventDate: utcDay(0, 8),
      endDate: null,
      location: 'Student Activities Building',
      registerUrl: null,
      publishedAt: published,
      body: MOCK_BODY
    },
    {
      id: 9003,
      slug: 'mock-film-development-workshop',
      title: 'Film Development Workshop',
      summary: 'Three afternoons in the darkroom: develop, fix, and scan your first roll of black-and-white film.',
      coverR2Key: null,
      eventDate: utcDay(0, 17),
      endDate: utcDay(0, 19),
      location: 'Faculty of Arts Darkroom',
      registerUrl: 'https://example.com/register',
      publishedAt: published,
      body: MOCK_BODY
    },
    {
      id: 9004,
      slug: 'mock-street-photography-night',
      title: 'Street Photography Night',
      summary: 'Neon, rain, and reflections — a night shoot around Sam Yan and Banthat Thong.',
      coverR2Key: null,
      eventDate: utcDay(0, 24),
      endDate: null,
      location: 'Sam Yan – Banthat Thong',
      registerUrl: null,
      publishedAt: published,
      body: MOCK_BODY
    },
    {
      id: 9005,
      slug: 'mock-portrait-lighting-basics',
      title: 'Portrait Lighting Basics',
      summary: 'One-light setups, reflectors, and how to direct a subject who has never modeled before.',
      coverR2Key: null,
      eventDate: utcDay(-1, 15),
      endDate: null,
      location: 'Club Studio, 4th Floor',
      registerUrl: null,
      publishedAt: published,
      body: MOCK_BODY
    },
    {
      id: 9006,
      slug: 'mock-annual-exhibition',
      title: 'Annual Exhibition: Frames of Chula',
      summary: 'A week-long showcase of the year\'s best member work, printed large and hung with care.',
      coverR2Key: null,
      eventDate: utcDay(1, 5),
      endDate: utcDay(1, 12),
      location: 'Chamchuri Art Gallery',
      registerUrl: null,
      publishedAt: published,
      body: MOCK_BODY
    },
    {
      id: 9007,
      slug: 'mock-khao-yai-field-trip',
      title: 'Field Trip: Khao Yai',
      summary: 'Two nights of landscapes, wildlife, and astrophotography in the national park.',
      coverR2Key: null,
      eventDate: utcDay(2, 10),
      endDate: utcDay(2, 12),
      location: 'Khao Yai National Park',
      registerUrl: 'https://example.com/register',
      publishedAt: published,
      body: MOCK_BODY
    },
    {
      id: 9008,
      slug: 'mock-freshman-photo-contest',
      title: 'Freshman Photo Contest',
      summary: 'Our yearly contest for first-year members — theme and dates announced soon.',
      coverR2Key: null,
      eventDate: null,
      endDate: null,
      location: null,
      registerUrl: null,
      publishedAt: published,
      body: MOCK_BODY
    }
  ]
}
