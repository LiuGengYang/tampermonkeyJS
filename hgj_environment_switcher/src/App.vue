<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import EnvSwitcher from './components/EnvSwitcher.vue'

const handler = () => {
    console.log(window.location.href)
}

function patchHistoryEvent(type: 'pushState' | 'replaceState') {
    const orig = history[type]
    return function (this: History, data: any, unused: string, url?: string | URL | null) {
        const result = orig.call(this, data, unused, url)
        window.dispatchEvent(new Event(type))
        return result
    }
}

onMounted(() => {
    window.addEventListener('popstate', handler)
    window.addEventListener('hashchange', handler)
    window.addEventListener('pushState', handler)
    window.addEventListener('replaceState', handler)
    history.pushState = patchHistoryEvent('pushState')
    history.replaceState = patchHistoryEvent('replaceState')
})

onUnmounted(() => {
    window.removeEventListener('popstate', handler)
    window.removeEventListener('hashchange', handler)
    window.removeEventListener('pushState', handler)
    window.removeEventListener('replaceState', handler)
})
</script>

<template>
    <EnvSwitcher />
</template>

<style scoped></style>
