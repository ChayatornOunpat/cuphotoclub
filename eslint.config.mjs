// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    name: 'cuphotoclub/vue3',
    files: ['**/*.vue'],
    rules: {
      // eslint-plugin-vue's version detection resolves to its Vue 2 ruleset
      // here (verified: `vue/no-v-for-template-key-on-child` is on while the
      // Vue 3 `vue/no-v-for-template-key` is not), even though this project is
      // Vue 3.5 on Nuxt 4 and no vue2 preset is referenced anywhere in the
      // config chain. Left alone these reject valid Vue 3 — fragment roots and
      // a layout whose root is <slot /> — so they are off deliberately.
      'vue/no-multiple-template-root': 'off',
      'vue/no-v-for-template-key-on-child': 'off'
    }
  }
)
