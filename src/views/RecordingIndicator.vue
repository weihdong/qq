<template>
    <div class="recording-indicator" v-if="isVisible">
      <div class="recording-dot"></div>
      <div>录制中... {{ duration }}秒</div>
      <button @click="stop">停止</button>
    </div>
  </template>
  
  <script setup>
  import { defineProps, defineEmits } from 'vue';
  
  defineProps({
    isVisible: Boolean,
    duration: Number
  });
  
  const emit = defineEmits(['stop']);
  
  const stop = () => {
    emit('stop');
  };
  </script>
  
  <style scoped>
  /* 样式已在ChatView中定义 */
  </style>