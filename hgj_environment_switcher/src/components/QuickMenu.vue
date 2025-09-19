<template>
    <div class="quick-switch" role="region" aria-label="快捷切换">
        <div class="quick-switch__header">快捷切换</div>
        <div class="quick-switch__list">
            <div
                class="quick-switch__item"
                v-for="item in accounts"
                :key="item.id"
            >
                <div class="item-top">
                    <div class="account-name">
                        <div>{{ item.name }}</div>
                        <div style="font-size: 10px">{{ item.account }}</div>
                    </div>
                    <div>
                        <n-tag
                            v-if="defaultAccount(item.id as string)"
                            round
                            :bordered="false"
                            type="success"
                        >
                            <span class="env"> 默认 </span>
                            <template #icon>
                                <n-icon :component="CheckmarkCircle" />
                            </template>
                        </n-tag>
                    </div>
                </div>
            </div>
            <!-- <div class="quick-switch__item">
                <div class="item-top">
                    <div class="account-name">
                        <div>王小明</div>
                    </div>
                    <div style="font-size: 10px">18605796752</div>
                </div>
            </div> -->
        </div>
    </div>
</template>

<script lang="ts" setup>
import { NTag, NIcon } from 'naive-ui'
import { useSwitcherStore } from '../store/switcher'

import { CheckmarkCircle } from '@vicons/ionicons5'
import { computed } from 'vue'
import { Env } from '../types'

const switcherStore = useSwitcherStore()

const props = defineProps<{
    env: Env
}>()

const accounts = computed(() => {
    switch (props.env) {
        case 'dev':
            return switcherStore.devAccounts
        case 'beta':
            return switcherStore.betaAccounts
        case 'prod':
            return switcherStore.prodAccounts
        default:
            return switcherStore.accounts
    }
})

const defaultAccount = computed(() => {
    return (id: string) => {
        return switcherStore.defaultAccount[props.env] === id
    }
})
// GM_openInTab
// TODO： 切换时同一环境 隐私窗口打开
</script>

<style scoped>
.quick-switch {
    width: 220px;
    height: 200px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    font-family: system-ui, -apple-system, 'Helvetica Neue', Arial;
    background: #fff;
    box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.quick-switch__header {
    padding: 8px 10px;
    background: linear-gradient(180deg, #f9fafb, #ffffff);
    border-bottom: 1px solid #f1f5f9;
    font-size: 13px;
    font-weight: 600;
    color: #111827;
}

.quick-switch__list {
    padding: 6px;
    overflow-y: auto;
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.quick-switch__item {
    display: flex;
    flex-direction: column;
    padding: 6px;
    border-radius: 4px;
    background: #fbfdff;
    border: 1px solid transparent;
    transition: background 0.15s, border-color 0.15s;
    font-size: 12px;
}

.quick-switch__item:hover {
    background: #f1f5f9;
    border-color: #e6eef8;
}

.item-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 6px;
}

.account-name {
    font-weight: 600;
    color: #0f172a;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 75px;
    font-size: 12px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
}

.badge-account {
    font-size: 11px;
    color: #374151;
    background: #eef2ff;
    padding: 2px 6px;
    border-radius: 999px;
}

.item-bottom {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 6px;
    gap: 6px;
}

.env {
    font-size: 11px;
    color: #6b7280;
    padding: 2px 6px;
}

.session-indicator {
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 999px;
    background: #e5e7eb;
    color: #374151;
}

.session-indicator.active {
    background: #10b981;
    color: #ffffff;
    box-shadow: 0 1px 0 rgba(16, 185, 129, 0.15) inset;
}

/* 微调滚动条 */
.quick-switch__list::-webkit-scrollbar {
    width: 6px;
    height: 6px;
}
.quick-switch__list::-webkit-scrollbar-track {
    background: transparent;
}
.quick-switch__list::-webkit-scrollbar-thumb {
    background: #e5e7eb;
    border-radius: 10px;
}
</style>
