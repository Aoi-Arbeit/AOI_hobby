<script setup>
import confetti from 'canvas-confetti'

function celebrate() {
  confetti({
    particleCount: 150,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff']
  })
}
</script>

<template>
  <button 
    @click="celebrate"
    class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors shadow-lg"
  >
    🎉 お祝いする！
  </button>
</template>