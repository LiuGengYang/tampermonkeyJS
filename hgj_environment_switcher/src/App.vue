<script setup lang="ts">
import { onMounted } from 'vue'
import EnvSwitcher from './components/EnvSwitcher.vue'
import StorageViewer from './components/StorageViewer.vue'
import { useSwitcherStore } from './store/switcher'
import { Account, Env, subAccount } from './types'
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
const env = switcherStore.currentEnv
const defaultAccount = switcherStore.accounts.find(
    item => item.userId === switcherStore.defaultAccount[env as Env]
) as {
    account: string
    password: string
    defaultSubAccount: subAccount
}

onMounted(() => {
    interceptSaasTenantLoginResponse(
        '/saas-tenant/login',
        ({ data }, request) => {
            console.log('登录接口返回值:', data, JSON.parse(request?.body))
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
        (to: any, from: any) => {
            console.log('路由发生改变', to, from)
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

const fillAccount = () => {
    if (
        window.location.pathname.includes('login') &&
        !isEmpty(defaultAccount)
    ) {
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
        let session_account = dataStorage.sessionGet('session_account')
        !isEmpty(session_account)
            ? fillInAccount(
                  session_account as { account: string; password: string }
              )
            : fillInAccount(defaultAccount)
        clickLoginBtn()
        setTimeout(() => {
            chooseSubAccount(
                !isEmpty(session_account)
                    ? session_account.defaultSubAccount
                    : defaultAccount.defaultSubAccount.enterpriseName
            )
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
