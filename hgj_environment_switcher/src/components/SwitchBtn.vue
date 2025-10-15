<script setup lang="ts">
import { GM_openInTab } from '$'
import { ref, onUnmounted, defineModel, watch } from 'vue'
import { Position, Env } from '../types'
import QuickMenu from './QuickMenu.vue'
import { NButton } from 'naive-ui'
import { Type } from 'naive-ui/es/button/src/interface'
import { useSwitcherStore } from '../store/switcher'
import { processUrl } from '../utils/utils'
import { createDiscreteApi } from 'naive-ui'

const switcherStore = useSwitcherStore()
const { message } = createDiscreteApi(['message'])

defineProps<{
    parentPos: Position
}>()

const show = defineModel('show', { type: Boolean, default: false })

const menu = ref([
    {
        name: '开发环境',
        value: 'dev',
        type: 'primary',
        show: false
    },
    {
        name: '测试环境',
        value: 'beta',
        type: 'info',
        show: false
    },
    {
        name: '生产环境',
        value: 'prod',
        type: 'warning',
        show: false
    }
])
enum HDirection {
    LEFT,
    RIGHT
}
enum VDirection {
    TOP,
    BOTTOM
}

const menuDirection = ref<[HDirection, VDirection]>([
    HDirection.LEFT,
    VDirection.TOP
])

const windowWidth =
    window.innerWidth ||
    document.documentElement.clientWidth ||
    document.body.clientWidth
const envOptions = ref<HTMLElement | null>(null)
const pos = ref({ x: 0, y: 0 })
const safeMargin = { width: 0, height: 0 }
let observer: IntersectionObserver | null = null
const btnWidth = 44
let move = false
let closeTimer: number | null = null
let overlayGuard: { handler: (e: MouseEvent) => void } | null = null

interface entry {
    boundingClientRect: DOMRect
    intersectionRatio: number
    isIntersecting: boolean
}

// 调整位置的函数
const adjustPosition = (entry: entry) => {
    if (!envOptions.value || move) return
    move = true
    const { x, y } = recordMoveStep(entry)
    pos.value.x = x
    pos.value.y = y
    setTimeout(() => (move = false), 300)
}

const recordMoveStep = (entry: entry) => {
    const { left, right, top, bottom } = entry.boundingClientRect
    let newX = pos.value.x
    let newY = pos.value.y
    if (left <= 0) {
        console.log('enter left')
        newX = pos.value.x + safeMargin.width + btnWidth
        menuDirection.value[0] = HDirection.RIGHT
    } else if (
        left > windowWidth - safeMargin.width &&
        menuDirection.value[0] === HDirection.RIGHT
    ) {
        console.log('enter right')
        console.log(window.innerWidth, right)
        newX = pos.value.x - safeMargin.width - btnWidth
        menuDirection.value[0] = HDirection.LEFT
    } else if (top < 0 && menuDirection.value[1] !== VDirection.BOTTOM) {
        console.log('enter top')
        newY = pos.value.y + safeMargin.height + btnWidth
        menuDirection.value[1] = VDirection.BOTTOM
    } else if (
        window.innerHeight <= bottom &&
        menuDirection.value[1] !== VDirection.TOP
    ) {
        console.log('enter bottom')
        newY = pos.value.y - safeMargin.height - btnWidth
        menuDirection.value[1] = VDirection.TOP
    }
    return { x: newX, y: newY }
}

const createObserver = () => {
    observer && observer.disconnect()
    observer = new IntersectionObserver(
        entries => {
            const entry = entries[0]
            console.log('enter move', entry)

            entry.intersectionRatio < 1 && adjustPosition(entry)
        },
        {
            threshold: [0, 0.1, 0.5, 0.9, 0.95, 1]
        }
    )
    envOptions.value && observer.observe(envOptions.value)
}

watch(show, newValue => {
    if (newValue) {
        setTimeout(init, 0)
    } else {
        observer && observer.disconnect()
    }
})

const init = () => {
    safeMargin.width = envOptions.value?.offsetWidth || 144
    safeMargin.height = envOptions.value?.offsetHeight || 150
    pos.value = {
        x: -safeMargin.width,
        y: -safeMargin.height
    }
    createObserver()
    closeTimer && clearTimeout(closeTimer) && (closeTimer = null)
    closeTimer = setTimeout(
        () =>
            ((envOptions.value as HTMLElement).style.transition =
                'all 0.3s ease'),
        100
    )
}

onUnmounted(() => {
    observer && observer.disconnect()
    closeTimer && clearTimeout(closeTimer) && (closeTimer = null)
    if (overlayGuard) {
        document.removeEventListener('mouseover', overlayGuard.handler, true)
        overlayGuard = null
    }
})

const openQuickMenu = (index: number) => {
    closeTimer && clearTimeout(closeTimer) && (closeTimer = null)
    if (menu.value[index].show) return
    closeQuickMenu()
    menu.value[index].show = true
}

const closeQuickMenu = (index?: number) => {
    if (index !== undefined) {
        closeTimer && clearTimeout(closeTimer)
        closeTimer = setTimeout(() => {
            menu.value[index].show = false
            closeTimer = null
            if (overlayGuard) {
                document.removeEventListener(
                    'mouseover',
                    overlayGuard.handler,
                    true
                )
                overlayGuard = null
            }
        }, 300)
    } else {
        closeTimer && clearTimeout(closeTimer) && (closeTimer = null)
        menu.value?.forEach(item => (item.show = false))
        if (overlayGuard) {
            document.removeEventListener(
                'mouseover',
                overlayGuard.handler,
                true
            )
            overlayGuard = null
        }
    }
}

// 检测是否在 Naive UI 弹层上（Popselect/Popover/Dropdown 等）
const isInOverlay = (el: EventTarget | null) => {
    if (!(el instanceof Element)) return false
    return !!el.closest(
        '.n-popselect-menu, .n-popover, .n-dropdown, .n-select-menu, .n-cascader-menu, .n-date-panel, .n-time-picker-panel, .v-binder-follower-container, .v-binder-follower-content'
    )
}

// 检测是否仍在我们组件区域内
const isInEnvOptions = (el: EventTarget | null) => {
    if (!(el instanceof Element)) return false
    return !!el.closest('.envOptions')
}

// 当鼠标离开菜单按钮时，如果是移入到弹层，则保持菜单打开，并在离开弹层后再关闭
const onMouseLeaveMenu = (evt: MouseEvent, index: number) => {
    const to = evt.relatedTarget as EventTarget | null
    if (isInOverlay(to)) {
        // 进入弹层，保持开启状态，并在全局监听中控制关闭
        if (closeTimer) {
            clearTimeout(closeTimer)
            closeTimer = null
        }
        if (!overlayGuard) {
            const handler = (e: MouseEvent) => {
                const target = e.target as EventTarget | null
                if (isInOverlay(target) || isInEnvOptions(target)) {
                    // 仍在弹层或本组件，保持开启
                    if (closeTimer) {
                        clearTimeout(closeTimer)
                        closeTimer = null
                    }
                } else {
                    // 离开弹层与组件，延迟关闭
                    if (!closeTimer) {
                        closeTimer = window.setTimeout(() => {
                            menu.value[index].show = false
                            if (overlayGuard) {
                                document.removeEventListener(
                                    'mouseover',
                                    overlayGuard.handler,
                                    true
                                )
                                overlayGuard = null
                            }
                            closeTimer = null
                        }, 300)
                    }
                }
            }
            overlayGuard = { handler }
            document.addEventListener('mouseover', handler, true)
        }
        return
    }
    // 非弹层，按原逻辑关闭
    closeQuickMenu(index)
}
const openNewTabByEnv = (env: Env) => {
    if (switcherStore.currentEnv === env) {
        message.info('当前已是该环境，无需重复打开')
        return
    } else {
        GM_openInTab(processUrl(env), {
            active: true,
            incognito: switcherStore.settings.incognito
        })
    }
    show.value = false
}

defineExpose({
    closeQuickMenu
})
</script>

<template>
    <div
        v-show="show"
        ref="envOptions"
        class="envOptions"
        :style="{ top: pos.y + 'px', left: pos.x + 'px' }"
    >
        <n-button
            :type="item.type as Type"
            class="ui-button"
            v-for="(item, index) in menu"
            :key="item.value"
            @mouseenter="openQuickMenu(index)"
            @mouseleave="onMouseLeaveMenu($event, index)"
            @click.stop="openNewTabByEnv(item.value as Env)"
        >
            <span>{{ item.name }}</span>
            <div
                class="quick-menu"
                :style="{
                    transform:
                        menuDirection[0] === HDirection.LEFT
                            ? 'translateX(-118%)'
                            : 'translateX(48%)'
                }"
                v-if="item.show"
            >
                <QuickMenu :env="item.value as Env" />
            </div>
        </n-button>
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
    /* transition: all 0.3s ease; */
}
button {
    width: 120px;
    margin-top: 8px;
}

.quick-menu {
    position: absolute;
    top: 0;
    color: black;
}
</style>
