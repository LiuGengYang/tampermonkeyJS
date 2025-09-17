<script setup lang="ts">
import { type Position } from '../types'
import { onMounted, ref, onUnmounted } from 'vue'
import SwitchBtn from './SwitchBtn.vue'
const pos = ref<Position>({ x: 0, y: 0 })
const startPos = ref<Position>({ x: 0, y: 0 })
let offsetX = 0
let offsetY = 0
let maxX = 0
let maxY = 0
const optionsShow = ref(false)
const moveThreshold = 5 // 移动阈值，超过这个距离才算拖动
const switcher = ref<HTMLElement | null>(null)
const envSwitcherBtn = ref<HTMLElement | null>(null)

// 拖拽状态管理
const isDragging = ref(false)
let hasMoved = false
let isMouseDown = false
let clickTimer: number | null = null
const clickTimeout = 150 // 150毫秒内判断为点击
let animationId: number | null = null
let pendingX: number | null = null
let pendingY: number | null = null

onMounted(() => {
    pos.value = { x: window.innerWidth - 80, y: window.innerHeight - 80 }
    maxX =
        window.innerWidth - (envSwitcherBtn.value as HTMLElement)?.offsetWidth
    maxY =
        window.innerHeight - (envSwitcherBtn.value as HTMLElement)?.offsetHeight

    // 在 document 级别监听鼠标事件，确保快速移动时不会丢失事件
    document.addEventListener('mousemove', handleDocumentMouseMove)
    document.addEventListener('mouseup', handleDocumentMouseUp)
})

onUnmounted(() => {
    document.removeEventListener('mousemove', handleDocumentMouseMove)
    document.removeEventListener('mouseup', handleDocumentMouseUp)
    document.removeEventListener('click', closeOptionsOnClickOutside)
    if (animationId) {
        cancelAnimationFrame(animationId)
    }
    if (clickTimer) {
        clearTimeout(clickTimer)
    }
})

// 使用 requestAnimationFrame 批量更新位置，提高性能
const updatePosition = () => {
    if (pendingX !== null && pendingY !== null) {
        const boundedX = Math.max(0, Math.min(pendingX, maxX))
        const boundedY = Math.max(0, Math.min(pendingY, maxY))
        pos.value = { x: boundedX, y: boundedY }

        pendingX = null
        pendingY = null
    }
    animationId = null
}

const dragStart = (e: MouseEvent) => {
    e.preventDefault()
    console.log('mousedown')

    isMouseDown = true
    hasMoved = false
    ;(switcher.value as HTMLElement).style.transition = 'none'
    startPos.value = { x: e.clientX, y: e.clientY }
    offsetX =
        e.clientX - (switcher.value as HTMLElement).getBoundingClientRect().left
    offsetY =
        e.clientY - (switcher.value as HTMLElement).getBoundingClientRect().top

    // 设置点击计时器
    clickTimer = window.setTimeout(() => {
        if (isMouseDown && !hasMoved) {
            // 150毫秒内没有移动，判断为拖拽开始
            startDragging()
        }
    }, clickTimeout)
}

const startDragging = () => {
    isDragging.value = true
    // optionsShow.value = false
    if (clickTimer) {
        clearTimeout(clickTimer)
        clickTimer = null
    }
}

const handleDocumentMouseMove = (e: MouseEvent) => {
    if (!isMouseDown) return

    const moveX = Math.abs(e.clientX - startPos.value.x)
    const moveY = Math.abs(e.clientY - startPos.value.y)

    if (moveX > moveThreshold || moveY > moveThreshold) {
        hasMoved = true

        // 如果移动超过阈值，立即开始拖拽
        if (!isDragging.value) {
            startDragging()
        }

        // 执行拖拽逻辑
        if (isDragging.value) {
            pendingX = e.clientX - offsetX
            pendingY = e.clientY - offsetY

            // 使用 requestAnimationFrame 来批量更新，避免频繁的 DOM 操作
            if (!animationId) {
                animationId = requestAnimationFrame(updatePosition)
            }
        }
    }
}

const handleDocumentMouseUp = () => {
    const wasMouseDown = isMouseDown
    const wasDragging = isDragging.value
    const hadMoved = hasMoved

    // 重置状态
    isMouseDown = false
    isDragging.value = false
    hasMoved = false

    // 清除计时器
    if (clickTimer) {
        clearTimeout(clickTimer)
        clickTimer = null
    }

    if (wasDragging) {
        // 如果是拖拽结束
        ;(switcher.value as HTMLElement).style.transition = 'all 0.3s ease'
    } else if (wasMouseDown && !hadMoved) {
        // 如果是点击（按下后没有移动且在150ms内松开）
        handleClick()
    }
}

const handleClick = () => {
    const newValue = !optionsShow.value
    optionsShow.value = newValue
    if (newValue) {
        setTimeout(() => {
            document.addEventListener('click', closeOptionsOnClickOutside)
        }, 0)
    }
}

const closeOptionsOnClickOutside = (e: Event) => {
    // 检查点击的目标是否在 switcher 元素外部
    if (switcher.value && !switcher.value.contains(e.target as Node)) {
        optionsShow.value = false
        document.removeEventListener('click', closeOptionsOnClickOutside)
    }
}
</script>

<template>
    <div
        ref="switcher"
        class="env-switcher"
        :style="{ left: pos.x + 'px', top: pos.y + 'px' }"
        @mousedown="dragStart"
    >
        <div ref="envSwitcherBtn" class="env-switcher-btn">
            <svg
                t="1757574763114"
                class="icon"
                viewBox="0 0 1024 1024"
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
                p-id="6581"
                width="20"
                height="20"
            >
                <path
                    d="M738.56 168.192l116.48 116.8a128 128 0 0 1 37.248 84.288l0.64 14.72A61.12 61.12 0 0 1 832 448H192a64 64 0 1 1 0-128h517.504l-61.312-61.376a64 64 0 0 1 90.432-90.432zM285.44 850.688l-116.48-116.864a128 128 0 0 1-37.248-84.288l-0.64-14.72a61.12 61.12 0 0 1 60.992-64H832a64 64 0 0 1 0 128l-517.504 0.064 61.312 61.376a64 64 0 0 1-90.432 90.432z"
                    fill="#ffffff"
                    p-id="6582"
                    data-spm-anchor-id="a313x.search_index.0.i1.28003a81ISwaJq"
                    class="selected"
                ></path>
            </svg>
        </div>
        <SwitchBtn v-if="optionsShow" :parentPos="pos" />
    </div>
</template>

<style scoped>
.env-switcher {
    position: fixed;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    color: white;
    font-weight: bold;
    cursor: move;
    z-index: 99999;
    transition: all 0.3s ease;
    user-select: none;
}

.env-switcher-btn {
    width: 40px;
    height: 40px;
    background-color: #4285f4;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    box-shadow: 0 3px 12px rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(5px);
    border: 2px solid rgba(255, 255, 255, 0.3);
    cursor: pointer;
    position: absolute;
    left: 0;
    top: 0;
    z-index: 99999;
}

/* .env-switcher:hover {
    filter: brightness(1.1);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
} */
</style>
