<script setup lang="ts">
const VK_GROUP_URL = 'https://vk.ru/vologdabrus'
</script>

<template>
  <p>
    Переходим в группу ВКонтакте…
    <a :href="VK_GROUP_URL">{{ VK_GROUP_URL }}</a>
  </p>
</template>
