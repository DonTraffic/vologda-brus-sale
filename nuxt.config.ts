// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/content',
  ],
  devtools: { enabled: true },
  compatibilityDate: '2024-04-03',
  // Любой запрос сразу уходит на группу ВК на уровне сервера — без загрузки приложения.
  routeRules: {
    '/**': { redirect: { to: 'https://vk.ru/vologdabrus', statusCode: 302 } },
  },
})
