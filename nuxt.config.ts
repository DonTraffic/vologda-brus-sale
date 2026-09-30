// https://nuxt.com/docs/api/configuration/nuxt-config
const VK_GROUP_URL = 'https://vk.ru/vologdabrus'

export default defineNuxtConfig({
  devtools: { enabled: true },
  // SSR отключён: приложение собирается как статика, серверный рендеринг не используется.
  ssr: false,
  compatibilityDate: '2024-04-03',
  // routeRules с redirect здесь использовать нельзя: это функция Nitro,
  // на статическом хостинге она не работает и вырезает index.html из сборки.
  // Редирект выполняется в браузере через meta refresh + location.replace.
  app: {
    head: {
      htmlAttrs: { lang: 'ru' },
      title: 'ВологдаБрус — переходим в группу ВКонтакте',
      meta: [
        { 'http-equiv': 'refresh', content: `0; url=${VK_GROUP_URL}` },
        { name: 'robots', content: 'noindex, follow' },
      ],
      link: [
        { rel: 'canonical', href: VK_GROUP_URL },
      ],
      script: [
        { innerHTML: `location.replace(${JSON.stringify(VK_GROUP_URL)})` },
      ],
    },
  },
  nitro: {
    // Статический хостинг: любой путь отдаётся тем же index.html.
    static: true,
    prerender: {
      routes: ['/'],
      failOnError: false,
    },
  },
})
