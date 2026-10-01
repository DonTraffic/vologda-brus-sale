// https://nuxt.com/docs/api/configuration/nuxt-config
const VK_GROUP_URL = 'https://vk.ru/vologdabrus'

// Редирект на ВК нужен только для корня. Раньше meta refresh и location.replace
// стояли глобально в head — так уходила на ВК любая страница, включая /calc.
// Теперь это один скрипт с проверкой пути: он срабатывает до загрузки Vue
// (мгновенно, без ожидания гидратации) и только на '/'.
const ROOT_REDIRECT = `(function(){var p=location.pathname;if(p==='/'||p===''||p==='/index.html'){location.replace(${JSON.stringify(VK_GROUP_URL)})}})()`

export default defineNuxtConfig({
  devtools: { enabled: true },
  // SSR отключён: приложение собирается как статика, серверный рендеринг не используется.
  ssr: false,
  compatibilityDate: '2024-04-03',
  // routeRules с redirect здесь использовать нельзя: это функция Nitro,
  // на статическом хостинге она не работает и вырезает index.html из сборки.
  // Редирект корня выполняется в браузере скриптом ниже.
  app: {
    head: {
      htmlAttrs: { lang: 'ru' },
      title: 'Вологда Брус — расчёт стенового комплекта',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
      script: [
        { innerHTML: ROOT_REDIRECT },
      ],
    },
  },
  nitro: {
    // Статический хостинг: неизвестный путь отдаётся тем же SPA-шаблоном,
    // дальше маршрут разбирает vue-router уже в браузере.
    static: true,
    prerender: {
      routes: ['/', '/calc'],
      failOnError: false,
    },
  },
})
