<script setup lang="ts">
import { onMounted } from 'vue'
import EnvSwitcher from './components/EnvSwitcher.vue'
import { useSwitcherStore } from './store/switcher'
import { Account, Env } from './types'
import { fillInAccount, clickLoginBtn } from './utils/utils'
import { isEmpty } from 'lodash'
import dataStorage from './lib/dataStorage'
const switcherStore = useSwitcherStore()
const env = switcherStore.currentEnv
const defaultAccount = switcherStore.accounts.find(
    item => item.id === switcherStore.defaultAccount[env as Env]
) as {
    account: string
    password: string
}

onMounted(() => {
    ;(document.querySelector('#app') as any)?.__vue__?.$router.afterHooks.push(
        (to: any, from: any) => {
            console.log('路由发生改变', to, from)
            if (to.name === 'login' || to.path.includes('login')) {
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
        if (urlSearchParams.has('id')) {
            let temporaryAccount = switcherStore.accounts.find(
                item => item.id === urlSearchParams.get('id')
            )
            dataStorage.sessionSet('session_account', {
                account: temporaryAccount?.account,
                password: temporaryAccount?.password
            }) as unknown as Account
        }
        let session_account = dataStorage.sessionGet('session_account')
        !isEmpty(session_account)
            ? fillInAccount(
                  session_account as { account: string; password: string }
              )
            : fillInAccount(defaultAccount)
        clickLoginBtn()
        dataStorage.remove('session_account')
    }
}
</script>

<template>
    <EnvSwitcher />
</template>

<style scoped></style>
