import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import dataStorage, {
    DefaultAccount,
    Setting,
    type EventCallback
} from '../lib/dataStorage'
import { Account, Env, Position } from '../types'
import { forEach } from 'lodash-es'
import { getCurrentEnvironment } from '../utils/utils'

export const useSwitcherStore = defineStore('switcher', () => {
    // 账号信息
    const accounts = ref<Account[]>([])
    // dev环境账号
    const devAccounts = computed(() =>
        accounts.value.filter(account => account.env.includes('dev'))
    )
    // beta环境账号
    const betaAccounts = computed(() =>
        accounts.value.filter(account => account.env.includes('beta'))
    )
    // prod环境账号
    const prodAccounts = computed(() =>
        accounts.value.filter(account => account.env.includes('prod'))
    )

    const position = ref<Position | null>(null)

    const defaultAccount = ref<DefaultAccount>({} as DefaultAccount)

    const settings = ref<Setting>({
        incognito: false,
        newTab: false
    })

    const currentEnv = ref<Env>()

    // 全局监听器
    const globalStorageListener: EventCallback = event => {
        switch (event.key) {
            case dataStorage.STORAGE_KEY:
                handleEnvironmentSwitchDataChange(event)
                break
            case dataStorage.SWITCH_BTN_POS:
                handlePositionChange(event)
                break
            case dataStorage.DEFAULT_ACCOUNT_KEY:
                handleDefaultAccountChange(event)
                break
        }
    }
    //监听账号信息变化
    const handleEnvironmentSwitchDataChange = (event: {
        key: string
        oldValue: any
        newValue: any
        remote: boolean
        timestamp: number
    }) => {
        event.newValue && (accounts.value = event.newValue)
    }

    const deleteAccountById = (id: string) => {
        const index = accounts.value.findIndex(account => account.id === id)
        if (index !== -1) {
            defaultAccount.value = forEach(
                defaultAccount.value,
                (value, key) => {
                    value === id &&
                        (defaultAccount.value[key as Env] = undefined)
                }
            )
            setDefaultAccount(defaultAccount.value)
            accounts.value.splice(index, 1)
            dataStorage.setSync(dataStorage.STORAGE_KEY, accounts.value)
            return true
        }
        return false
    }

    const addNewAccount = (account: Required<Account>) => {
        dataStorage.push(dataStorage.STORAGE_KEY, account)
        return true
    }

    const upDataAccountById = (id: string, account: Required<Account>) => {
        const index = accounts.value.findIndex(account => account.id === id)
        if (index !== -1) {
            accounts.value[index] = account
            dataStorage.setSync(dataStorage.STORAGE_KEY, accounts.value)
            defaultAccount.value = forEach(
                defaultAccount.value,
                (value, key) => {
                    if (
                        value === id &&
                        !accounts.value[index].env.includes(key as Env)
                    ) {
                        defaultAccount.value[key as Env] = undefined
                    }
                }
            )
            setDefaultAccount(defaultAccount.value)
            return true
        } else {
            return false
        }
    }

    // 监听悬浮按钮位置变化
    const handlePositionChange = (event: {
        key: string
        oldValue: any
        newValue: any
        remote: boolean
        timestamp: number
    }) => {
        position.value = event.newValue as Position
    }

    const setPosition = (pos: Position) => {
        position.value = pos
        dataStorage.setSync(dataStorage.SWITCH_BTN_POS, pos)
    }

    const handleDefaultAccountChange = (event: {
        key: string
        oldValue: any
        newValue: any
        remote: boolean
        timestamp: number
    }) => {
        defaultAccount.value = event.newValue as DefaultAccount
    }

    const setDefaultAccount = (account: DefaultAccount) => {
        defaultAccount.value = account
        dataStorage.setSync(dataStorage.DEFAULT_ACCOUNT_KEY, account)
    }
    const setSettings = (settings: Setting) => {
        dataStorage.setSync(dataStorage.SETTINGS_KEY, settings)
    }

    dataStorage.onStorageChange(globalStorageListener)
    ;(() => {
        // 初始获取默认数据
        accounts.value = dataStorage.getSync(
            dataStorage.STORAGE_KEY,
            []
        ) as Account[]
        position.value = dataStorage.getSync(
            dataStorage.SWITCH_BTN_POS
        ) as Position
        defaultAccount.value = dataStorage.getSync(
            dataStorage.DEFAULT_ACCOUNT_KEY,
            {} as DefaultAccount
        ) as DefaultAccount
        settings.value = dataStorage.getSync(dataStorage.SETTINGS_KEY, {
            incognito: false,
            newTab: false
        }) as Setting
        currentEnv.value = getCurrentEnvironment() as Env
    })()

    return {
        accounts,
        deleteAccountById,
        addNewAccount,
        upDataAccountById,
        devAccounts,
        betaAccounts,
        prodAccounts,
        position,
        setPosition,
        defaultAccount,
        setDefaultAccount,
        settings,
        setSettings,
        currentEnv
    }
})
