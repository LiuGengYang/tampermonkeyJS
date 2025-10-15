<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import dataStorage, {
    type StorageKey,
    type StorageDataMap
} from '../lib/dataStorage'
import JsonFold from './JsonFold.vue'

const keys: StorageKey[] = [
    'hgj_environment_switcher_data',
    'hgj_cross_env_sync_timestamp',
    'hgj_default_account_id',
    'hgj_switch_btn_pos',
    'hgj_switch_settings'
]

type ValuesState = Partial<{ [K in StorageKey]: StorageDataMap[K] | null }>
const values = ref<ValuesState>({})
function setVal<K extends StorageKey>(key: K, val: StorageDataMap[K] | null) {
    // 通过函数泛型约束，避免索引访问的联合类型冲突
    ;(values.value as any)[key] = val
}
const unsubscribes: Array<() => void> = []

const loadAll = async () => {
    for (const k of keys) {
        const v = await dataStorage.get(k as any)
        setVal(k, v as any)
    }
}

onMounted(async () => {
    await loadAll()
    for (const k of keys) {
        const off = dataStorage.onKeyChange(k, ({ newValue }) => {
            // 使用新对象触发 Vue 响应式
            values.value = { ...values.value, [k]: newValue as any }
            // 轻微高亮提示更新的 key
            addUpdated(k)
            setTimeout(() => removeUpdated(k), 800)
            // 值变化时强制展开一次
            bumpForceOpen(k)
            // 保证面板是展开状态
            if (!toggleOpen.value) toggleOpen.value = true
        })
        unsubscribes.push(off)
    }
})

onBeforeUnmount(() => unsubscribes.forEach(fn => fn()))

const toggleOpen = ref(true)

// 用于关键值更新时的闪烁动画
const updatedKeys = ref<Set<StorageKey>>(new Set())
function addUpdated(key: StorageKey) {
    const s = new Set(updatedKeys.value)
    s.add(key)
    updatedKeys.value = s
}
function removeUpdated(key: StorageKey) {
    const s = new Set(updatedKeys.value)
    s.delete(key)
    updatedKeys.value = s
}

// 用于通知 JsonFold 强制展开（每次变化递增触发）
const forceOpenSeq = ref<Record<StorageKey, number>>({
    hgj_environment_switcher_data: 0,
    hgj_cross_env_sync_timestamp: 0,
    hgj_default_account_id: 0,
    hgj_switch_btn_pos: 0,
    hgj_switch_settings: 0
})
function bumpForceOpen(key: StorageKey) {
    forceOpenSeq.value = {
        ...forceOpenSeq.value,
        [key]: (forceOpenSeq.value[key] ?? 0) + 1
    }
}
</script>

<template>
    <div class="storage-viewer" :class="{ closed: !toggleOpen }">
        <div class="header" @click="toggleOpen = !toggleOpen">
            <strong>Storage 实时视图</strong>
            <span class="hint">(点击{{ toggleOpen ? '折叠' : '展开' }})</span>
        </div>
        <Transition name="collapse">
            <div v-if="toggleOpen" class="content">
                <TransitionGroup name="kv" tag="div">
                    <div
                        v-for="(k, i) in keys"
                        :key="k"
                        class="kv"
                        :style="{ transitionDelay: i * 30 + 'ms' }"
                    >
                        <div class="key">{{ k }}</div>
                        <div class="val" :class="{ flash: updatedKeys.has(k) }">
                            <JsonFold
                                :value="values[k]"
                                :forceOpenSeq="forceOpenSeq[k]"
                            />
                        </div>
                    </div>
                </TransitionGroup>
            </div>
        </Transition>
    </div>
</template>

<style scoped>
.storage-viewer {
    width: 600px;
    max-height: 60vh;
    background: rgba(0, 0, 0, 0.75);
    color: #e6e6e6;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    overflow: hidden;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
        'Liberation Mono', 'Courier New', monospace;
    z-index: 999999;
    transition: max-height 0.22s ease;
}
.storage-viewer.closed {
    max-height: 40px;
}
.header {
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.06);
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
}
.hint {
    opacity: 0.7;
    font-size: 12px;
}
.content {
    padding: 8px 10px 10px;
    overflow: auto;
    max-height: calc(60vh - 40px);
}
.kv {
    margin-bottom: 10px;
    border-bottom: 1px dashed rgba(255, 255, 255, 0.15);
    padding-bottom: 10px;
}
.key {
    font-weight: 600;
    color: #a6e3ff;
    margin-bottom: 6px;
}
.val {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    background: rgba(255, 255, 255, 0.04);
    padding: 8px;
    border-radius: 6px;
}

/* 折叠/展开过渡 */
.collapse-enter-active,
.collapse-leave-active {
    transition: transform 0.18s ease, opacity 0.18s ease;
    transform-origin: top;
}
.collapse-enter-from,
.collapse-leave-to {
    transform: scaleY(0.98);
    opacity: 0;
}

/* 列表项进入/移动过渡（含轻微错位） */
.kv-enter-active,
.kv-leave-active,
.kv-move {
    transition: all 0.2s ease;
}
.kv-enter-from,
.kv-leave-to {
    opacity: 0;
    transform: translateY(-4px);
}
.kv-leave-active {
    position: absolute;
}

/* 值更新闪烁效果 */
.flash {
    animation: flash-bg 0.8s ease;
}
@keyframes flash-bg {
    0% {
        background: rgba(255, 255, 255, 0.16);
        box-shadow: 0 0 0 0 rgba(166, 227, 255, 0.45);
        color: #fff;
    }
    100% {
        background: rgba(255, 255, 255, 0.04);
        box-shadow: 0 0 0 0 rgba(166, 227, 255, 0);
        color: inherit;
    }
}
</style>
