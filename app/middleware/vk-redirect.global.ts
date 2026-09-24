const VK_GROUP_URL = 'https://vk.ru/vologdabrus'

export default defineNuxtRouteMiddleware(() => {
  return navigateTo(VK_GROUP_URL, { external: true, redirectCode: 302 })
})
