import {
    GM_setValue,
    GM_getValue,
    GM_deleteValue,
    GM_addValueChangeListener,
    GM_removeValueChangeListener
} from '$'

import { isArray, isObject, isEmpty } from 'lodash'

import { createDiscreteApi } from 'naive-ui'

import { type Position, type Account, type Env } from '../types'

const { message } = createDiscreteApi(['message'])

export type StorageKey =
    | 'hgj_environment_switcher_data' // 存储数据
    | 'hgj_cross_env_sync_timestamp' // 跨环境同步时间戳
    | 'hgj_default_account_id' // 会话当前账号ID键名
    | 'hgj_switch_btn_pos' // 切换按钮位置
    | 'hgj_switch_settings' // 设置数据

export type DefaultAccount = Record<Env, string | undefined>

export type Setting = {
    incognito: boolean // 同环境下切换账号是否使用隐私窗口打开
    debug: boolean // 是否新标签打开
    pubkey: string // 公钥
}

// 定义每个存储键对应的数据类型
export type StorageDataMap = {
    hgj_environment_switcher_data: Account[]
    hgj_cross_env_sync_timestamp: number
    hgj_default_account_id: DefaultAccount
    hgj_switch_btn_pos: Position
    hgj_switch_settings: Setting
}

// 定义每个存储键的默认值类型映射
export type StorageDefaultMap = {
    hgj_environment_switcher_data: []
    hgj_cross_env_sync_timestamp: 0
    hgj_default_account_id: {}
    hgj_switch_btn_pos: { x: 0; y: 0 }
    hgj_switch_settings: {}
}

// 联合类型，表示所有可能的存储数据
export type StorageData = StorageDataMap[StorageKey]

// 定义push方法的参数类型
export type PushValue<K extends StorageKey> =
    K extends 'hgj_environment_switcher_data'
        ? Account
        : K extends 'hgj_cross_env_sync_timestamp'
        ? number
        : K extends 'hgj_default_account_id'
        ? string
        : K extends 'hgj_switch_btn_pos'
        ? Partial<Position>
        : K extends 'hgj_switch_settings'
        ? Record<string, any>
        : never

export type CallBack = (
    key: StorageKey,
    oldValue: StorageData,
    newValue: StorageData,
    remote: boolean
) => void

export type Event = {
    key: StorageKey
    oldValue: StorageData | null
    newValue: StorageData | null
    remote: boolean
    timestamp: number
}

// 新增：事件回调类型
export type EventCallback = (event: Event) => void

// 新增：特定键的事件回调类型
export type KeySpecificEventCallback<K extends StorageKey> = (event: {
    key: K
    oldValue: StorageDataMap[K] | null
    newValue: StorageDataMap[K] | null
    remote: boolean
    timestamp: number
}) => void

class DataStorage {
    STORAGE_KEY: StorageKey = 'hgj_environment_switcher_data' //账号数据
    CROSS_ENV_SYNC_KEY: StorageKey = 'hgj_cross_env_sync_timestamp' // 跨环境同步时间戳
    DEFAULT_ACCOUNT_KEY: StorageKey = 'hgj_default_account_id' // 会话当前账号ID键名
    SWITCH_BTN_POS: StorageKey = 'hgj_switch_btn_pos' // 切换按钮位置
    SETTINGS_KEY: StorageKey = 'hgj_switch_settings' // 设置数据

    // 新增：回调函数注册表
    private eventCallbacks: Map<StorageKey, EventCallback[]> = new Map()
    private globalCallbacks: EventCallback[] = []
    private listenerIds: (string | number)[] = []

    /**
     * 获取指定键的默认值
     *
     * @private
     * @template K
     * @param {K} key
     * @return {*}  {StorageDefaultMap[K]}
     * @memberof DataStorage
     */
    private getDefaultValue<K extends StorageKey>(
        key: K
    ): StorageDefaultMap[K] {
        const defaults: StorageDefaultMap = {
            hgj_environment_switcher_data: [],
            hgj_cross_env_sync_timestamp: 0,
            hgj_default_account_id: {},
            hgj_switch_btn_pos: { x: 0, y: 0 },
            hgj_switch_settings: {}
        }
        return defaults[key]
    }

    /**
     * 初始化数据 - 监听所有 StorageKey
     *
     * @memberof DataStorage
     */
    init() {
        // 获取所有 StorageKey
        const allKeys: StorageKey[] = [
            'hgj_environment_switcher_data',
            'hgj_cross_env_sync_timestamp',
            'hgj_default_account_id',
            'hgj_switch_btn_pos',
            'hgj_switch_settings'
        ]

        // 为每个 key 添加监听器
        allKeys.forEach(key => {
            try {
                const listenerId = GM_addValueChangeListener(
                    key,
                    (name, oldValue, newValue, remote) => {
                        this.handleStorageChange(
                            name as StorageKey,
                            oldValue,
                            newValue,
                            remote as boolean
                        )
                    }
                )
                if (listenerId !== null) {
                    this.listenerIds.push(listenerId)
                }
            } catch (error) {
                console.error(`Failed to add listener for key: ${key}`, error)
            }
        })
    }

    /**
     * 处理存储变更事件
     *
     * @private
     * @param {StorageKey} key
     * @param {*} oldValue
     * @param {*} newValue
     * @param {boolean} remote
     * @memberof DataStorage
     */
    private handleStorageChange(
        key: StorageKey,
        oldValue: StorageData | null,
        newValue: StorageData | null,
        remote: boolean
    ) {
        const event = {
            key,
            oldValue,
            newValue,
            remote,
            timestamp: Date.now()
        }

        // 执行全局回调
        this.globalCallbacks.forEach(callback => {
            try {
                callback(event)
            } catch (error) {
                console.error('Error in global storage callback:', error)
            }
        })

        // 执行特定 key 的回调
        const keyCallbacks = this.eventCallbacks.get(key)
        if (keyCallbacks) {
            keyCallbacks.forEach(callback => {
                try {
                    callback(event)
                } catch (error) {
                    console.error(
                        `Error in storage callback for key ${key}:`,
                        error
                    )
                }
            })
        }
    }

    /**
     * 注册全局存储变更回调（监听所有 key 的变更）
     *
     * @param {EventCallback} callback
     * @return {*} {() => void} 返回取消监听的函数
     * @memberof DataStorage
     */
    onStorageChange(callback: EventCallback): () => void {
        this.globalCallbacks.push(callback)

        // 返回取消监听的函数
        return () => {
            const index = this.globalCallbacks.indexOf(callback)
            if (index > -1) {
                this.globalCallbacks.splice(index, 1)
            }
        }
    }

    /**
     * 注册特定 key 的存储变更回调
     *
     * @template K
     * @param {K} key
     * @param {KeySpecificEventCallback<K>} callback
     * @return {*} {() => void} 返回取消监听的函数
     * @memberof DataStorage
     */
    onKeyChange<K extends StorageKey>(
        key: K,
        callback: KeySpecificEventCallback<K>
    ): () => void {
        // 创建一个包装回调，转换通用事件到特定类型
        const wrappedCallback: EventCallback = event => {
            if (event.key === key) {
                callback({
                    key: key as K,
                    oldValue: event.oldValue as StorageDataMap[K] | null,
                    newValue: event.newValue as StorageDataMap[K] | null,
                    remote: event.remote,
                    timestamp: event.timestamp
                })
            }
        }

        if (!this.eventCallbacks.has(key)) {
            this.eventCallbacks.set(key, [])
        }

        this.eventCallbacks.get(key)!.push(wrappedCallback)

        // 返回取消监听的函数
        return () => {
            const callbacks = this.eventCallbacks.get(key)
            if (callbacks) {
                const index = callbacks.indexOf(wrappedCallback)
                if (index > -1) {
                    callbacks.splice(index, 1)
                }
            }
        }
    }

    /**
     * 移除所有回调监听器（清理资源）
     *
     * @memberof DataStorage
     */
    destroy() {
        // 清理 GM 监听器
        this.listenerIds.forEach(id => {
            try {
                GM_removeValueChangeListener(id)
                console.log('Cleaning up listener:', id)
            } catch (error) {
                console.error('Error removing GM listener:', error)
            }
        })

        // 清理回调
        this.globalCallbacks.length = 0
        this.eventCallbacks.clear()
        this.listenerIds.length = 0
    }

    /**
     * 设置存储数据
     *
     * @template K
     * @param {K} key
     * @param {StorageDataMap[K]} value
     * @return {*}  {Promise<boolean>}
     * @memberof DataStorage
     */
    async set<K extends StorageKey>(
        key: K,
        value: StorageDataMap[K]
    ): Promise<boolean> {
        try {
            await GM_setValue(key, value)
            return true
        } catch (error) {
            return false
        }
    }

    /**
     * 向存储数据追加内容(除数组对象外直接覆盖原有内容)
     *
     * @template K
     * @param {K} key
     * @param {PushValue<K>} value
     * @return {*}  {Promise<boolean>}
     * @memberof DataStorage
     */
    async push<K extends StorageKey>(
        key: K,
        value: PushValue<K>
    ): Promise<boolean> {
        try {
            const currentValue = await this.get(key)
            if (isEmpty(currentValue)) {
                // 如果没有值，使用默认值初始化
                const defaultValue = this.getDefaultValue(key)
                if (isArray(defaultValue)) {
                    const newArray = [...defaultValue, value as Account]
                    await GM_setValue(key, newArray)
                } else if (isObject(defaultValue)) {
                    const updatedValue = Object.assign({}, defaultValue, value)
                    await GM_setValue(key, updatedValue)
                } else {
                    // 对于基本类型，直接设置传入的值
                    await GM_setValue(key, value)
                }
                await GM_setValue(this.CROSS_ENV_SYNC_KEY, new Date().getTime())
                return true
            }

            if (isArray(currentValue)) {
                const newArray = [...currentValue, value as Account]
                await GM_setValue(key, newArray)
                return true
            }

            if (isObject(currentValue)) {
                const updatedValue = Object.assign({}, currentValue, value)
                await GM_setValue(key, updatedValue)
                return true
            }

            // 对于非对象非数组类型，直接覆盖
            await GM_setValue(key, value)
            return true
        } catch (error) {
            console.error('Error in push method:', error)
            message.error('数据格式不匹配，未插入数据')
            return false
        }
    }

    /**
     * 获取指定存储数据
     *
     * @template K
     * @param {K} key
     * @param {StorageDataMap[K] | null} [defaultValue=null]
     * @return {*}  {Promise<StorageDataMap[K] | null>}
     * @memberof DataStorage
     */
    async get<K extends StorageKey>(
        key: K,
        defaultValue: StorageDataMap[K] | null = null
    ): Promise<StorageDataMap[K] | null> {
        try {
            const value = await GM_getValue(key, defaultValue)
            return value as StorageDataMap[K] | null
        } catch (error) {
            return defaultValue
        }
    }

    /**
     *  删除指定存储数据
     *
     * @param {StorageKey} key
     * @return {*}  {Promise<boolean>}
     * @memberof DataStorage
     */
    async delete(key: StorageKey): Promise<boolean> {
        try {
            await GM_deleteValue(key)
            return true
        } catch (error) {
            return false
        }
    }

    /**
     * 添加数据变更监听
     *
     * @param {StorageKey} key
     * @param {Function} callback
     * @return {*}
     * @memberof DataStorage
     */
    addListener(key: StorageKey, callback: CallBack) {
        try {
            const listenerId = GM_addValueChangeListener(
                key,
                (name, oldValue, newValue, remote) => {
                    callback(
                        name as StorageKey,
                        oldValue,
                        newValue,
                        remote as boolean
                    )
                }
            )
            return listenerId
        } catch (error) {
            return null
        }
    }

    /**
     * 同步获取指定存储数据
     *
     * @template K
     * @param {K} key
     * @param {StorageDataMap[K] | null} [defaultValue=null]
     * @return {*}  {StorageDataMap[K] | null}
     * @memberof DataStorage
     */
    getSync<K extends StorageKey>(
        key: K,
        defaultValue: StorageDataMap[K] | null = null
    ): StorageDataMap[K] | null {
        try {
            return GM_getValue(key, defaultValue) as StorageDataMap[K] | null
        } catch (error) {
            return defaultValue
        }
    }

    /**
     * 同步设置存储数据
     *
     * @template K
     * @param {K} key
     * @param {StorageDataMap[K]} value
     * @return {*}  {boolean}
     * @memberof DataStorage
     */
    setSync<K extends StorageKey>(key: K, value: StorageDataMap[K]): boolean {
        try {
            GM_setValue(key, value)
            return true
        } catch (error) {
            return false
        }
    }

    /**
     * 会话存储获取
     *
     * @param {string} key
     * @param {(Record<string, any> | null)} [defaultValue=null]
     * @return {*}  {(Record<string, any> | null)}
     * @memberof DataStorage
     */
    sessionGet(
        key: string,
        defaultValue: Record<string, any> | null = null
    ): Record<string, any> | null {
        try {
            const value = sessionStorage.getItem(key)
            return value !== null ? JSON.parse(value) : defaultValue
        } catch (error) {
            return defaultValue
        }
    }

    /**
     *会话存储设置
     *
     * @param {string} key
     * @param {Record<string, any>} value
     * @return {*}  {boolean}
     * @memberof DataStorage
     */
    sessionSet(key: string, value: Record<string, any>): boolean {
        try {
            if (value === null || value === undefined) {
                sessionStorage.removeItem(key)
            } else {
                sessionStorage.setItem(key, JSON.stringify(value))
            }
            return true
        } catch (error) {
            return false
        }
    }

    /**
     * 会话存储移除
     *
     * @param {string} key
     * @return {*}  {boolean}
     * @memberof DataStorage
     */
    remove(key: string): boolean {
        try {
            sessionStorage.removeItem(key)
            return true
        } catch (error) {
            return false
        }
    }

    constructor() {
        this.init()
    }
}

export default new DataStorage()
