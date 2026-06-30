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

  // Private (server-only) config. NUXT_ADMIN_PASSWORD overrides at runtime.
  // Session secret comes from NUXT_SESSION_PASSWORD (nuxt-auth-utils).
  runtimeConfig: {
    adminPassword: 'cuphoto1967',
    oauth: {
      google: { clientId: '', clientSecret: '' }
    },
    session: {
      cookie: {
        secure: process.env.NODE_ENV === 'production'
      }
    },
    public: {
      siteUrl: 'http://localhost:3000'
    }
  },

  app: {
    head: {
      // <html lang> is set reactively per-locale in app.vue (useHead).
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' }
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: 'anonymous' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Noto+Serif+Thai:wght@300;400;500;600&display=swap'
        }
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

  // Placeholder imagery is served from picsum during design; swap for NuxtHub blob later.
  image: {
    domains: ['picsum.photos']
  },

  icon: {
    // heroicons (Tailwind Plus icons) + simple-icons (brand logos)
    serverBundle: { collections: ['heroicons', 'simple-icons'] }
  },

  i18n: {
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
