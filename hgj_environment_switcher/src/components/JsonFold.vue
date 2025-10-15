<script setup lang="ts">
import { computed, ref, watch } from 'vue'

type Props = {
    value: unknown
    label?: string
    collapsed?: boolean
    // 当该序列值变化时，强制展开一次（不影响之后用户的手动折叠）
    forceOpenSeq?: number
}

const props = defineProps<Props>()

const isObjectLike = (v: unknown) =>
    v !== null && typeof v === 'object' && !(v instanceof Date)

const isArray = computed(() => Array.isArray(props.value))
const isObj = computed(
    () => isObjectLike(props.value) && !Array.isArray(props.value)
)

const entries = computed(() => {
    if (Array.isArray(props.value)) {
        return (props.value as unknown[]).map((v, i) => [String(i), v])
    }
    if (isObjectLike(props.value)) {
        return Object.entries(props.value as Record<string, unknown>)
    }
    return [] as Array<[string, unknown]>
})

const summaryText = computed(() => {
    if (props.label) return props.label
    if (props.value === null) return 'null'
    if (props.value === undefined) return 'undefined'
    if (isArray.value) return `Array(${(props.value as unknown[]).length})`
    if (isObj.value)
        return `Object{${Object.keys(props.value as object).length}}`
    return formatPrimitive(props.value)
})

function formatPrimitive(v: unknown): string {
    const t = typeof v
    if (t === 'string') return JSON.stringify(v)
    if (t === 'number' || t === 'boolean') return String(v)
    if (v === null) return 'null'
    if (v === undefined) return 'undefined'
    try {
        return JSON.stringify(v)
    } catch {
        return String(v)
    }
}

// 受控展开：默认由 collapsed 控制初始状态，用户交互通过 @toggle 同步。
const openFlag = ref<boolean>(
    props.collapsed === undefined ? true : !props.collapsed
)

watch(
    () => props.collapsed,
    v => {
        if (v !== undefined) openFlag.value = !v
    }
)

// 当收到强制展开序列变化时，展开一次
watch(
    () => props.forceOpenSeq,
    () => {
        if (isArray.value || isObj.value) openFlag.value = true
    }
)
</script>

<template>
    <template v-if="isArray || isObj">
        <details
            :open="openFlag"
            class="jf-details"
            @toggle="openFlag = ($event.target as HTMLDetailsElement).open"
        >
            <summary class="jf-summary">{{ summaryText }}</summary>
            <div class="jf-children">
                <div v-for="(pair, idx) in entries" :key="idx" class="jf-row">
                    <span class="jf-key">{{ pair[0] }}:</span>
                    <div class="jf-val">
                        <JsonFold
                            :value="pair[1]"
                            :collapsed="true"
                            :forceOpenSeq="forceOpenSeq"
                        />
                    </div>
                </div>
            </div>
        </details>
    </template>
    <template v-else>
        <span class="jf-primitive">{{ formatPrimitive(value) }}</span>
    </template>
</template>

<style scoped>
.jf-details {
    margin: 0;
}
.jf-summary {
    cursor: pointer;
    list-style: none;
    user-select: none;
}
.jf-children {
    padding-left: 8px; /* 原 12px -> 8px */
    border-left: 1px dashed rgba(255, 255, 255, 0.12); /* 更轻的分隔线 */
    margin-left: 2px; /* 原 4px -> 2px */
}
.jf-row {
    display: flex;
    gap: 4px; /* 原 6px -> 4px */
    align-items: flex-start;
    margin: 1px 0; /* 原 2px -> 1px */
}
.jf-key {
    color: #a6e3ff;
    white-space: nowrap;
}
.jf-val {
    flex: 1;
}
.jf-primitive {
    white-space: pre-wrap;
    word-break: break-word;
}
</style>
