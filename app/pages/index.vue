<script setup lang="ts">
// Корень — переходник в группу ВК. Основной редирект делает скрипт из
// nuxt.config (срабатывает до загрузки Vue). Здесь дубль на случай,
// если на страницу попали клиентской навигацией, а не загрузкой документа.
import { VK_GROUP_URL } from '~/data/pricing'

useHead({
  title: 'Вологда Брус — переходим в группу ВКонтакте',
  meta: [{ name: 'robots', content: 'noindex, follow' }],
  link: [{ rel: 'canonical', href: VK_GROUP_URL }],
})

onMounted(() => {
  location.replace(VK_GROUP_URL)
})
</script>

<template>
  <p class="redirect">
    Переходим в группу ВКонтакте…
    <a :href="VK_GROUP_URL">{{ VK_GROUP_URL }}</a>
  </p>
</template>

<style scoped>
.redirect {
  font-family: system-ui, sans-serif;
  padding: 2rem;
  text-align: center;
}
</style>
