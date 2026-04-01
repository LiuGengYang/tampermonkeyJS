<script setup lang="ts">
import EnvSwitcher from './components/EnvSwitcher.vue'
import StorageViewer from './components/StorageViewer.vue'
import { useSwitcherStore } from './store/switcher'
import { useLoginFlow } from './composables/useLoginFlow'

const switcherStore = useSwitcherStore()

// 使用登录流程 composable
useLoginFlow()
</script>

<template>
    <EnvSwitcher />
    <StorageViewer v-if="switcherStore.settings.debug" />
</template>

<style scoped></style>
