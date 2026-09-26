// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  // SSR отключён: приложение собирается как SPA, серверный рендеринг не используется.
  ssr: false,
  compatibilityDate: '2024-04-03',
  // Любой запрос сразу уходит на группу ВК на уровне сервера — без загрузки приложения.
  routeRules: {
    '/**': { redirect: { to: 'https://vk.ru/vologdabrus', statusCode: 302 } },
  },
})
