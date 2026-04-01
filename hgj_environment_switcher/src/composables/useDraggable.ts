import { onMounted, onUnmounted, ref, type Ref } from 'vue'
import { type Position } from '../types'
import { useSwitcherStore } from '../store/switcher'

export interface UseDraggableOptions {
    switcher: Ref<HTMLElement | null>
    envSwitcherBtn: Ref<HTMLElement | null>
}

export interface UseDraggableReturn {
    pos: Ref<Position>
    optionsShow: Ref<boolean>
    dragStart: (e: MouseEvent) => void
    handleClick: () => void
    showDialog: (dialogRef?: Ref<any>) => void
}

export function useDraggable(options: UseDraggableOptions): UseDraggableReturn {
    const { switcher, envSwitcherBtn } = options
    const switcherStore = useSwitcherStore()

    // 位置相关状态
    const pos = ref<Position>({ x: 0, y: 0 })
    const startPos = ref<Position>({ x: 0, y: 0 })

    // 边界值
    let offsetX = 0
    let offsetY = 0
    let maxX = 0
    let maxY = 0

    // 选项显示状态
    const optionsShow = ref(false)

    // 拖拽状态管理
    const isDragging = ref(false)
    let hasMoved = false
    let isMouseDown = false
    let justFinishedDragging = false // 标记是否刚刚完成拖拽
    let clickTimer: number | null = null
    const clickTimeout = 150 // 150毫秒内判断为点击
    let animationId: number | null = null
    let pendingX: number | null = null
    let pendingY: number | null = null
    let moveAnimationId: number | null = null

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

        // 在位置更新后检查边界
        if (moveAnimationId) {
            cancelAnimationFrame(moveAnimationId)
            moveAnimationId = null
        }
        // 延迟执行边界检查，确保位置已经稳定
        setTimeout(() => {
            keepVisible()
        }, 50)
    }

    const dragStart = (e: MouseEvent) => {
        e.preventDefault()
        isMouseDown = true
        hasMoved = false
        ;(switcher.value as HTMLElement).style.transition = 'none'
        startPos.value = { x: e.clientX, y: e.clientY }
        offsetX =
            e.clientX -
            (switcher.value as HTMLElement).getBoundingClientRect().left
        offsetY =
            e.clientY -
            (switcher.value as HTMLElement).getBoundingClientRect().top

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
        // 关闭所有弹窗
        optionsShow.value = false
        document.removeEventListener('click', closeOptionsOnClickOutside)
        if (clickTimer) {
            clearTimeout(clickTimer)
            clickTimer = null
        }
    }

    const handleDocumentMouseMove = (e: MouseEvent) => {
        if (!isMouseDown) return

        const moveX = Math.abs(e.clientX - startPos.value.x)
        const moveY = Math.abs(e.clientY - startPos.value.y)

        if (moveX > 5 || moveY > 5) {
            // moveThreshold = 5
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
        // 重置鼠标按下状态
        isMouseDown = false
        // 只有真正发生过拖拽移动，才标记刚刚完成拖拽
        if (hasMoved) {
            justFinishedDragging = true
        }
        // 立即重置拖拽状态，避免300ms延迟导致的点击问题
        hasMoved = false
        isDragging.value = false

        // 重置样式过渡
        if (switcher.value) {
            ;(switcher.value as HTMLElement).style.transition = 'all 0.3s ease'
        }

        // 延迟清除点击计时器（防止快速拖拽时误触发）
        setTimeout(() => {
            isDragging.value = false
            // 500ms 后取消拖拽完成标记
            setTimeout(() => {
                justFinishedDragging = false
            }, 500)
        }, 100)
    }

    const closeOptionsOnClickOutside = (e: Event) => {
        // 检查点击的目标是否在 switcher 元素外部
        if (switcher.value && !switcher.value.contains(e.target as Node)) {
            optionsShow.value = false
            document.removeEventListener('click', closeOptionsOnClickOutside)
        }
    }

    const handleClick = (): boolean => {
        // 如果正在拖拽，不处理点击
        if (isDragging.value) return false

        // 如果刚刚完成拖拽，不处理点击（防止拖拽后误触发菜单）
        if (justFinishedDragging || hasMoved) return false

        const newValue = !optionsShow.value
        optionsShow.value = newValue
        if (newValue) {
            setTimeout(() => {
                document.addEventListener('click', closeOptionsOnClickOutside)
            }, 0)
        }
        return true
    }

    const showDialog = (dialogRef?: Ref<any>) => {
        optionsShow.value = false
        // 检查 dialogRef 是否存在且 value 不为 undefined
        if (dialogRef?.value) {
            ;(dialogRef.value as any).openDialog()
        } else {
            // 如果不存在，尝试通过事件触发（兼容性方案）
            const event = new CustomEvent('openAccountManageDialog')
            window.dispatchEvent(event)
        }
    }

    const keepVisible = () => {
        if (!envSwitcherBtn.value || maxX === undefined || maxY === undefined)
            return
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
                updateMaxBounds()
                keepVisible()
            }
        })
    }

    const updateMaxBounds = () => {
        if (envSwitcherBtn.value) {
            maxX = window.innerWidth - envSwitcherBtn.value.offsetWidth
            maxY = window.innerHeight - envSwitcherBtn.value.offsetHeight
        }
    }

    onMounted(() => {
        pos.value = { x: window.innerWidth - 80, y: window.innerHeight - 80 }
        switcherStore.position &&
            (pos.value = switcherStore.position as Position)

        // 确保边界值正确初始化
        updateMaxBounds()

        // 在 document 级别监听鼠标事件，确保快速移动时不会丢失事件
        document.addEventListener('mousemove', handleDocumentMouseMove)
        document.addEventListener('mouseup', handleDocumentMouseUp)
        setTimeout(() => {
            if (switcher.value) {
                ;(switcher.value as HTMLElement).style.transition =
                    'all 0.3s ease'
            }
        }, 1000)

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

    return {
        pos,
        optionsShow,
        dragStart,
        handleClick,
        showDialog
    }
}
