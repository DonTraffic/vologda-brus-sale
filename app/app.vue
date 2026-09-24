<script setup lang="ts">
const VK_GROUP_URL = 'https://vk.ru/vologdabrus'

// Запасной вариант на случай статического хостинга без серверных редиректов:
// meta refresh срабатывает даже при отключённом JS.
useHead({
  meta: [
    { 'http-equiv': 'refresh', content: `0; url=${VK_GROUP_URL}` },
  ],
  link: [
    { rel: 'canonical', href: VK_GROUP_URL },
  ],
})
</script>

<template>
  <NuxtRouteAnnouncer />
  <NuxtPage />
</template>
