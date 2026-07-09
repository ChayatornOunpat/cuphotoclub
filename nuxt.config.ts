import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: [
    '@nuxt/image',
    '@nuxt/fonts',
    '@nuxt/icon',
    '@nuxt/content',
    '@nuxt/eslint',
    '@nuxthub/core',
    '@nuxtjs/i18n',
    'nuxt-auth-utils'
  ],

  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: []
    }
  },

  // NuxtHub: sqlite (libsql driver, local file in dev) + R2 blob + KV.
  // Schema lives in server/db/schema.ts; migrations in server/db/migrations/sqlite.
  hub: {
    db: { dialect: 'sqlite', applyMigrationsDuringDev: true },
    blob: true,
    kv: true
  },

  nitro: {
    serverAssets: [
      { baseName: 'content-albums', dir: '../content/albums' }
    ],
    prerender: {
      crawlLinks: false,
      routes: []
    }
  },

  routeRules: {
    // Sensible security headers site-wide; long-cache the image route.
    '/**': {
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'Referrer-Policy': 'strict-origin-when-cross-origin'
      }
    },
    '/images/**': { headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
    '/api/settings': { cache: { maxAge: 60 } }
  },

  // Private (server-only) config.
  // Session secret comes from NUXT_SESSION_PASSWORD (nuxt-auth-utils).
  runtimeConfig: {
    oauth: {
      google: { clientId: '', clientSecret: '' }
    },
    r2DirectUpload: {
      accountId: process.env.NUXT_R2_ACCOUNT_ID || '',
      bucketName: process.env.NUXT_R2_BUCKET_NAME || 'cuphotoclub-blob',
      accessKeyId: process.env.NUXT_R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.NUXT_R2_SECRET_ACCESS_KEY || ''
    },
    session: {
      cookie: {
        secure: process.env.NODE_ENV === 'production'
      }
    },
    public: {
      realDataOnly: process.env.NUXT_PUBLIC_REAL_DATA_ONLY === 'false' || process.env.NUXT_REAL_DATA_ONLY === 'false'
        ? false
        : process.env.NODE_ENV === 'production'
          || process.env.NUXT_PUBLIC_REAL_DATA_ONLY === 'true'
          || process.env.NUXT_REAL_DATA_ONLY === 'true',
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || (process.env.NODE_ENV === 'production' ? 'https://cuphotoclub.com' : 'http://localhost:3000')
    }
  },

  app: {
    head: {
      // <html lang> is set reactively per-locale in app.vue (useHead).
      // Fonts are self-hosted by @nuxt/fonts (see `fonts` below) — no external
      // Google Fonts <link> here, which would be a render-blocking duplicate.
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' }
      ]
    }
  },

  // Editorial type pairing — @nuxt/fonts provisions these from Google automatically.
  fonts: {
    families: [
      { name: 'Spectral', provider: 'google', weights: [200, 300, 400, 500, 600], styles: ['normal', 'italic'] },
      { name: 'Inter', provider: 'google', weights: [300, 400, 500] },
      { name: 'Noto Serif Thai', provider: 'google', weights: [300, 400, 500, 600] },
      { name: 'Noto Sans Thai', provider: 'google', weights: [300, 400, 500, 600] },
      { name: 'IBM Plex Sans Thai Looped', provider: 'google', weights: [300, 400, 500, 600] },
      { name: 'Sarabun', provider: 'google', weights: [300, 400, 500, 600] },
      { name: 'Anuphan', provider: 'google', weights: [300, 400, 500, 600] }
    ]
  },

  // picsum: design placeholders. localhost / prod: R2 blob images are served
  // via a server route (/images/**), not from public/, so IPX must HTTP-fetch them.
  image: {
    domains: ['picsum.photos', 'localhost', 'cuphotoclub.com', 'www.cuphotoclub.com', 'cuphotoclub.pages.dev'],
  },

  icon: {
    // heroicons (Tailwind Plus icons) + simple-icons (brand logos)
    serverBundle: { collections: ['heroicons', 'simple-icons'] }
  },

  i18n: {
    // Absolute base used by useLocaleHead() for canonical + hreflang URLs.
    // Must match the production domain (same source as public.siteUrl).
    baseUrl: process.env.NUXT_PUBLIC_SITE_URL || 'https://cuphotoclub.com',
    locales: [
      { code: 'en', language: 'en', name: 'English', file: 'en.json' },
      { code: 'th', language: 'th', name: 'ไทย', file: 'th.json' }
    ],
    defaultLocale: 'en',
    strategy: 'prefix_except_default',
    langDir: 'locales',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      redirectOn: 'root'
    }
  }
})
