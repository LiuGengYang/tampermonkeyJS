<script setup lang="ts">
import { type Position } from '../types'
import { onMounted, ref, onUnmounted } from 'vue'
import SwitchBtn from './SwitchBtn.vue'
import AccountManage from './AccountManage.vue'
import { useSwitcherStore } from '../store/switcher'
import { globalEmitter } from '../utils/utils'

const switcherStore = useSwitcherStore()
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
const accountManage = ref<HTMLElement | null>(null)
const switchBtn = ref()

// 拖拽状态管理
const isDragging = ref(false)
let hasMoved = false
let isMouseDown = false
let clickTimer: number | null = null
const clickTimeout = 150 // 150毫秒内判断为点击
let animationId: number | null = null
let pendingX: number | null = null
let pendingY: number | null = null
let moveAnimationId: number | null = null

onMounted(() => {
    pos.value = { x: window.innerWidth - 80, y: window.innerHeight - 80 }
    switcherStore.position && (pos.value = switcherStore.position as Position)
    maxX =
        window.innerWidth - (envSwitcherBtn.value as HTMLElement)?.offsetWidth
    maxY =
        window.innerHeight - (envSwitcherBtn.value as HTMLElement)?.offsetHeight

    // 在 document 级别监听鼠标事件，确保快速移动时不会丢失事件
    document.addEventListener('mousemove', handleDocumentMouseMove)
    document.addEventListener('mouseup', handleDocumentMouseUp)
    setTimeout(
        () =>
            ((switcher.value as HTMLElement).style.transition =
                'all 0.3s ease'),
        1000
    )
    globalEmitter.on('addNewByEnv', () => {
        optionsShow.value = false
        ;(accountManage.value as any).openDialog()
    })
    keepVisible()
    resizeListeners()
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
            switcherStore.setPosition({
                x: pendingX,
                y: pendingY
            })
            // 使用 requestAnimationFrame 来批量更新，避免频繁的 DOM 操作
            if (!animationId) {
                animationId = requestAnimationFrame(updatePosition)
            }
        }
    }
}

const handleDocumentMouseUp = () => {
    // 清除计时器
    if (clickTimer) {
        clearTimeout(clickTimer)
        clickTimer = null
    }
    // 重置状态
    isMouseDown = false
    clickTimer = setTimeout(() => {
        isDragging.value = false
    }, 300)
    hasMoved = false
    ;(switcher.value as HTMLElement).style.transition = 'all 0.3s ease'
}

const handleClick = () => {
    if (isDragging.value) return
    const newValue = !optionsShow.value
    !newValue && switchBtn.value?.closeQuickMenu()
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

const showDialog = () => {
    optionsShow.value = false
    ;(accountManage.value as any).openDialog()
}

const keepVisible = () => {
    if (!envSwitcherBtn.value) return
    const rect = envSwitcherBtn.value.getBoundingClientRect()

    // 计算目标 pos（基于当前 pos 调整），使按钮处于可见区域
    let targetX = pos.value.x
    let targetY = pos.value.y

    // 如果按钮超出左侧或上侧，则往相反方向移动
    const padding = 8
    if (rect.left < 0) {
        // 向右移动足够的像素使其可见
        targetX = pos.value.x + -rect.left + padding
    }
    if (rect.top < 0) {
        targetY = pos.value.y + -rect.top + padding
    }

    // 如果按钮超出右侧或底部，则向左/向上移动
    if (rect.right > window.innerWidth) {
        targetX = pos.value.x - (rect.right - window.innerWidth) - padding
    }
    if (rect.bottom > window.innerHeight) {
        targetY = pos.value.y - (rect.bottom - window.innerHeight) - padding
    }

    // 边界约束
    const boundedX = Math.max(0, Math.min(targetX, maxX))
    const boundedY = Math.max(0, Math.min(targetY, maxY))

    // 如果位置已经在可见范围内，不做任何事
    if (
        Math.round(boundedX) === Math.round(pos.value.x) &&
        Math.round(boundedY) === Math.round(pos.value.y)
    ) {
        return
    }

    // 平滑移动到目标位置
    const duration = 200
    const startX = pos.value.x
    const startY = pos.value.y
    const startTime = performance.now()

    if (moveAnimationId) {
        cancelAnimationFrame(moveAnimationId)
        moveAnimationId = null
    }

    const step = (now: number) => {
        const t = Math.min(1, (now - startTime) / duration)
        // easeOutCubic
        const ease = 1 - Math.pow(1 - t, 3)
        pos.value.x = startX + (boundedX - startX) * ease
        pos.value.y = startY + (boundedY - startY) * ease
        if (t < 1) {
            moveAnimationId = requestAnimationFrame(step)
        } else {
            moveAnimationId = null
            // 最终写入 store
            switcherStore.setPosition({
                x: Math.round(boundedX),
                y: Math.round(boundedY)
            })
        }
    }

    moveAnimationId = requestAnimationFrame(step)
}

const resizeListeners = () => {
    let lastDevicePixelRatio = window.devicePixelRatio
    window.addEventListener('resize', function () {
        const newDevicePixelRatio = window.devicePixelRatio
        if (lastDevicePixelRatio !== newDevicePixelRatio) {
            lastDevicePixelRatio = newDevicePixelRatio
            maxX =
                window.innerWidth -
                (envSwitcherBtn.value as HTMLElement)?.offsetWidth
            maxY =
                window.innerHeight -
                (envSwitcherBtn.value as HTMLElement)?.offsetHeight
            keepVisible()
        }
    })
}
</script>

<template>
    <div
        ref="switcher"
        class="env-switcher"
        :style="{ left: pos.x + 'px', top: pos.y + 'px' }"
    >
        <div
            ref="envSwitcherBtn"
            class="env-switcher-btn"
            @mousedown.stop="dragStart"
            @click.stop="handleClick"
        >
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
        <div class="account-icon" @mousedown.stop @click.stop="showDialog">
            <svg
                t="1758098433552"
                class="icon"
                viewBox="0 0 1024 1024"
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
                p-id="17033"
                width="25"
                height="25"
            >
                <path
                    d="M757.700755 776.680844c0.036125-0.296225 0.065025-0.59245 0.0867-0.895901C757.65018 775.893318 757.570705 776.088393 757.700755 776.680844z"
                    fill="#4C79ED"
                    p-id="17034"
                ></path>
                <path
                    d="M661.030184 417.583631c0-88.116165-71.440852-159.557017-159.549792-159.557017-88.116165 0-159.549792 71.440852-159.549792 159.557017 0 88.145065 71.433627 159.549792 159.549792 159.549792C589.589332 577.140648 661.030184 505.728695 661.030184 417.583631z"
                    fill="#4C79ED"
                    p-id="17035"
                ></path>
                <path
                    d="M757.787455 775.784943c0.007225-0.007225 0.01445-0.021675 0.021675-0.0289l0.093925-1.069301C757.89583 775.055218 757.816355 775.416468 757.787455 775.784943z"
                    fill="#4C79ED"
                    p-id="17036"
                ></path>
                <path
                    d="M501.545417 7.225005C224.545939 7.225005 0 231.770945 0 508.770423c0 276.977803 224.545939 501.516517 501.545417 501.516517 276.992253 0 501.538192-224.538714 501.538192-501.516517C1003.08361 231.770945 778.53767 7.225005 501.545417 7.225005zM757.715205 776.832569c-0.021675-0.079475 0-0.0867-0.01445-0.151725-0.989826 7.44898-7.282805 13.185635-14.999111 13.185635-8.409906 0-15.880562-6.777055-15.880562-15.186961-29.297396-96.706696-119.060862-167.150497-225.333465-167.150497-106.279828 0-196.484019 73.803429-225.78864 170.524575l0.411825-3.374077c0 10.078882-10.042757 15.186961-15.851662 15.186961-8.402681 0-15.194186-6.777055-15.194186-15.186961 0.4046-1.640076 0.50575-3.244027 0.968151-4.913004 0.151725-0.411825 0.21675-0.859776 0.3757-1.271601 24.817893-84.922712 90.637691-152.332012 174.780103-178.963381-64.721597-30.279997-109.64668-95.78912-109.64668-171.955126 0-104.878177 85.031087-189.945389 189.945389-189.945389 104.878177 0 189.938164 85.059987 189.938164 189.945389 0 76.166006-44.968433 141.675129-109.668355 171.940676 84.142412 26.63137 149.954985 94.055119 174.772878 178.963381 0.180625 0.411825 1.242701 5.787229 1.365526 6.19183 0.238425 0.830876 0.07225 0.946476-0.093925 1.069301L757.715205 776.832569z"
                    fill="#4C79ED"
                    p-id="17037"
                ></path>
            </svg>
        </div>
        <SwitchBtn
            v-model:show="optionsShow"
            :parentPos="pos"
            ref="switchBtn"
        />
    </div>
    <AccountManage ref="accountManage" />
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
    z-index: 99999999;
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

.account-icon {
    position: absolute;
    right: -60px;
    top: -15px;
    cursor: pointer;
}
</style>
