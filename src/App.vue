<template>
  <router-view />
</template>

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

onMounted(() => {
  if (!localStorage.getItem('userId') && !window.location.pathname.includes('/login')) {
    router.push('/login')
  }
})
</script>