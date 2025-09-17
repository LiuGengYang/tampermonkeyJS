<script setup lang="ts">
import { onMounted, ref, defineProps, onUnmounted } from 'vue'
import { Position } from '../types'

defineProps<{
    parentPos: Position
}>()
const envOptions = ref<HTMLElement | null>(null)
const pos = ref({ x: -140, y: -165 })
const safeMargin = { width: 0, height: 0 }
let observer: IntersectionObserver | null = null
const btnWidth = 44
let move = false

interface entry {
    boundingClientRect: DOMRect
    intersectionRatio: number
    isIntersecting: boolean
}

// 调整位置的函数
const adjustPosition = (entry: entry) => {
    if (!envOptions.value && move) return
    const { left, right, top, bottom } = entry.boundingClientRect
    let newX = pos.value.x
    let newY = pos.value.y
    move = true
    if (left <= 0) {
        newX = pos.value.x + safeMargin.width + btnWidth
    }
    if (window.innerWidth <= right) {
        newX = pos.value.x - safeMargin.width - btnWidth
    }
    if (top < 0) {
        newY = pos.value.y + safeMargin.height + btnWidth
    }
    if (window.innerHeight <= bottom) {
        newY = pos.value.y - safeMargin.height - btnWidth
    }
    pos.value.x = newX
    pos.value.y = newY
    setTimeout(() => (move = false), 300)
}

const createObserver = () => {
    observer && observer.disconnect()
    observer = new IntersectionObserver(
        entries => {
            const entry = entries[0]
            !entry.isIntersecting && adjustPosition(entry)
        },
        {
            threshold: [1]
        }
    )
    envOptions.value && observer.observe(envOptions.value)
}

onMounted(() => {
    if (envOptions.value) {
        safeMargin.width = envOptions.value.offsetWidth || 0
        safeMargin.height = envOptions.value.offsetHeight || 0
        createObserver()
    }
})

onUnmounted(() => {
    observer && observer.disconnect()
})
</script>

<template>
    <div
        ref="envOptions"
        class="envOptions"
        :style="{ top: pos.y + 'px', left: pos.x + 'px' }"
        @click.stop
    >
        <button class="ui-button">开发环境</button>
        <button class="ui-button">测试环境</button>
        <button class="ui-button">生产环境</button>
    </div>
</template>

<style scoped>
.el-button {
    margin-left: 0px !important;
}
.envOptions {
    display: flex;
    flex-direction: column;
    padding: 12px;
    z-index: 9999;
    position: absolute;
    transition: all 0.3s ease;
    button {
        width: 120px;
        margin-top: 8px;
    }
}
</style>
