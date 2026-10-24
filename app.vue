<script setup lang="ts">
const { isSignedIn } = useAuth()
</script>

<template>
  <div>
    <div v-if="!isSignedIn">
      <p>Please sign in.</p>
    </div>
    <div v-else>
      <NuxtPage />
    </div>
  </div>
</template>
