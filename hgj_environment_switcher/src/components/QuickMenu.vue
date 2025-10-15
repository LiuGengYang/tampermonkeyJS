<template>
    <div class="quick-switch" role="region" aria-label="快捷切换">
        <div class="quick-switch__header">
            <span>快捷切换</span>
        </div>
        <div
            class="quick-switch__list"
            :style="{
                'justify-content': !accounts.length ? 'center' : 'flex-start'
            }"
        >
            <div
                class="quick-switch__item"
                v-for="item in accounts"
                :key="item.userId"
                @click.stop="fillAccount(item)"
            >
                <div class="item-top">
                    <div class="account-name">
                        <div
                            class="account-name__text"
                            :title="item.defaultSubAccount!.enterpriseName"
                        >
                            <n-icon
                                v-if="defaultAccount(item.userId as string)"
                                :component="CheckmarkCircle"
                                color="#4FA063"
                                :size="16"
                                style="margin-right: 4px"
                            />
                            <span>{{
                                item.defaultSubAccount!.enterpriseName
                            }}</span>
                        </div>
                        <div style="font-size: 10px; margin-top: 10px">
                            {{ item.account }}
                        </div>
                    </div>
                    <div class="options">
                        <n-popselect
                            :default-value="item.defaultSubAccount!.enterpriseId"
                            :options="
                                item.subAccount?.map(i => ({
                                    label: i.enterpriseName,
                                    value: i.enterpriseName
                                }))
                            "
                            trigger="hover"
                            :on-update:value="value => fillAccount(item, value)"
                        >
                            <div class="switch-sub-account" @click.stop>
                                <n-icon
                                    :component="SwapHorizontalOutline"
                                    :size="10"
                                />
                                <span>切换</span>
                            </div>
                        </n-popselect>
                        <n-button
                            type="primary"
                            size="small"
                            class="copyBtn"
                            @click.stop="copyToClipboard(item)"
                            >复制</n-button
                        >
                    </div>
                </div>
            </div>
            <n-empty v-if="!accounts.length" description="暂无数据">
                <n-button type="primary" @click.stop="addNewByEnv">
                    添加新账号
                </n-button>
            </n-empty>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { NIcon, NEmpty, NButton, NPopselect } from 'naive-ui'
import { useSwitcherStore } from '../store/switcher'
import { CheckmarkCircle, SwapHorizontalOutline } from '@vicons/ionicons5'
import {
    globalEmitter,
    fillInAccount,
    clickLoginBtn,
    chooseSubAccount
} from '../utils/utils'
import dataStorage from '../lib/dataStorage'
import { clearHGJCookie, logOut, processUrl } from '../utils/utils'
import { computed, ref } from 'vue'
import { Account, Env } from '../types'
import { GM_openInTab, GM_setClipboard } from '$'
import { createDiscreteApi } from 'naive-ui'

const switcherStore = useSwitcherStore()
const { message } = createDiscreteApi(['message'])

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

const defaultAccountName = ref<string[]>([])

accounts.value.forEach(item =>
    defaultAccountName.value.push(item.defaultSubAccount!.enterpriseName)
)

const defaultAccount = computed(() => {
    return (id: string) => {
        return switcherStore.defaultAccount[props.env] === id
    }
})

const fillAccount = (account: Account, sessionSubAccount?: string) => {
    if (switcherStore.currentEnv === props.env) {
        dataStorage.sessionSet('session_account', {
            account: account.account,
            password: account.password,
            defaultSubAccount: sessionSubAccount || account.defaultSubAccount
        })
        if (!window.location.pathname.includes('login')) {
            clearHGJCookie()
            logOut()
        } else {
            fillInAccount(account)
            clickLoginBtn()
            setTimeout(() => {
                chooseSubAccount(
                    sessionSubAccount ||
                        account.defaultSubAccount!.enterpriseName
                )
            }, 1000)
        }
    } else {
        let url = `${processUrl(props.env)}?id=${account.userId}?subAccount=${
            sessionSubAccount || account.defaultSubAccount!.enterpriseName
        }`
        GM_openInTab(url, {
            active: true,
            incognito: switcherStore.settings.incognito
        })
    }
}

const addNewByEnv = () => {
    globalEmitter.emit('addNewByEnv')
}

const copyToClipboard = (account: Account) => {
    GM_setClipboard(
        `账号: ${account.account} \n密码: ${account.password}`,
        'text'
    )
    message.success('账号信息已复制到剪贴板')
}
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
    display: flex;
    justify-content: center;
    align-items: center;
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

.options {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
}

.copyBtn {
    width: 50px;
    height: 20px;
    margin-top: 10px;
}
.subAccount {
    padding: 8px 12px;
    border-radius: 6px;
    cursor: pointer;
    transition: background-color 0.2s ease, box-shadow 0.2s ease;
}

.subAccount:hover {
    background-color: #f0fdf4;
    box-shadow: 0 2px 4px rgba(34, 197, 94, 0.1);
    transform: translateY(-1px);
}

.account-name__text {
    display: flex;
    align-items: center;
}
.account-name__text span {
    max-width: 100px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.switch-sub-account {
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 2px 6px;
    font-size: 10px;
    color: #6b7280;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.2s ease;
    margin-bottom: 4px;
}

.switch-sub-account:hover {
    background: #f0fdf4;
    border-color: #4fa063;
    color: #4fa063;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(79, 160, 99, 0.1);
}
</style>
