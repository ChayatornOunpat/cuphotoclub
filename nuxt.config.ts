import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: [
    '@nuxt/image',
    '@nuxt/fonts',
    '@nuxt/icon',
    '@nuxt/eslint',
    '@nuxthub/core',
    'nuxt-auth-utils'
  ],

  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [tailwindcss()]
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

  runtimeConfig: {
    // nuxt-auth-utils reads NUXT_OAUTH_GOOGLE_CLIENT_ID / _SECRET into these
    oauth: {
      google: { clientId: '', clientSecret: '' }
    },
    public: {
      siteUrl: 'http://localhost:3000'
    }
  },

  app: {
    head: {
      htmlAttrs: { lang: 'th' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' }
      ]
    }
  },

  icon: {
    // heroicons (Tailwind Plus icons) + simple-icons (brand logos)
    serverBundle: { collections: ['heroicons', 'simple-icons'] }
  }
})
