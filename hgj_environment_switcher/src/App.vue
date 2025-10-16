<script setup lang="ts">
import { onMounted } from 'vue'
import EnvSwitcher from './components/EnvSwitcher.vue'
import StorageViewer from './components/StorageViewer.vue'
import { useSwitcherStore } from './store/switcher'
import { Account, Env } from './types'
import {
    fillInAccount,
    clickLoginBtn,
    interceptSaasTenantLoginResponse,
    chooseSubAccount
} from './utils/utils'
import { isEmpty } from 'lodash'
import dataStorage from './lib/dataStorage'
import { createDiscreteApi } from 'naive-ui'

const { message } = createDiscreteApi(['message'])
const switcherStore = useSwitcherStore()
// 不在模块顶层缓存 defaultAccount，避免数据变更后变 stale

onMounted(() => {
    interceptSaasTenantLoginResponse(
        '/saas-tenant/login',
        ({ data }, request) => {
            const body = JSON.parse(request?.body)
            const user = data.loginResultResponse
            const pwdInput = document.querySelector(
                'input[type=password]'
            ) as HTMLInputElement | null
            const hasAccount = switcherStore.accounts.find(
                item => item.userId === user.userId
            )
            if (hasAccount) {
                switcherStore.upDataAccountById(user.userId, {
                    account: body.loginName,
                    password: pwdInput?.value!,
                    env: switcherStore.currentEnv,
                    userId: user.userId,
                    subAccount: user.enterpriseInfos,
                    defaultSubAccount: hasAccount.defaultSubAccount!
                })
                message.success('更新账号成功')
            } else {
                switcherStore.addNewAccount({
                    account: body.loginName,
                    password: pwdInput?.value!,
                    env: switcherStore.currentEnv,
                    userId: user.userId,
                    subAccount: user.enterpriseInfos,
                    defaultSubAccount:
                        user.enterpriseInfos?.length > 0
                            ? user.enterpriseInfos[0]
                            : undefined
                })
                message.success('检测到新账号，已存入数据库')
            }
        }
    )
    ;(document.querySelector('#app') as any)?.__vue__?.$router.afterHooks.push(
        (to: any) => {
            if (
                to.name === 'login' ||
                to.name === 'Login' ||
                to.path.includes('login')
            ) {
                fillAccount()
            }
        }
    )
    fillAccount()
})

/** 简单轮询等待登录输入框出现 */
const waitForLoginInputs = async (timeout = 2500): Promise<boolean> => {
    const start = Date.now()
    while (Date.now() - start < timeout) {
        const hasPwd = !!document.querySelector('input[type=password]')
        const hasText = !!document.querySelector(
            'input[type=text], input[type=email], input:not([type])'
        )
        if (hasPwd && hasText) return true
        await new Promise(r => setTimeout(r, 100))
    }
    return false
}

const fillAccount = async () => {
    if (!window.location.pathname.includes('login')) return

    // 动态计算 defaultAccount，避免使用过期的模块级缓存
    const currentEnv = switcherStore.currentEnv as Env
    const defaultAccount =
        switcherStore.accounts.find(
            item => item.userId === switcherStore.defaultAccount[currentEnv]
        ) || null

    let urlSearchParams = new URL(window.location.href).searchParams
    if (urlSearchParams.has('id') && urlSearchParams.has('subAccount')) {
        let temporaryAccount = switcherStore.accounts.find(
            item => item.userId === urlSearchParams.get('id')
        )
        dataStorage.sessionSet('session_account', {
            account: temporaryAccount?.account,
            password: temporaryAccount?.password,
            defaultSubAccount: urlSearchParams.get('subAccount')
        }) as unknown as Account
    }

    const session_account = dataStorage.sessionGet('session_account')

    // 等待输入框就绪，避免因页面尚未渲染导致填充失败
    await waitForLoginInputs(2500)

    if (!isEmpty(session_account) || defaultAccount) {
        if (!isEmpty(session_account)) {
            fillInAccount(
                session_account as { account: string; password: string }
            )
        } else if (defaultAccount) {
            fillInAccount(defaultAccount)
        }
        clickLoginBtn()
        setTimeout(() => {
            const targetSub = !isEmpty(session_account)
                ? (session_account as any).defaultSubAccount
                : defaultAccount?.defaultSubAccount?.enterpriseName
            if (targetSub) {
                chooseSubAccount(targetSub)
            }
        }, 1000)
        dataStorage.remove('session_account')
    }
}
</script>

<template>
    <EnvSwitcher />
    <StorageViewer v-if="switcherStore.settings.debug" />
</template>

<style scoped></style>
