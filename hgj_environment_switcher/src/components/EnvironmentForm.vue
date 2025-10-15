<template>
    <n-form
        size="small"
        label-placement="left"
        label-width="80"
        ref="formRef"
        :model="envModel"
    >
        <n-form-item path="dev" label="开发环境">
            <n-select
                v-model:value="envModel.dev"
                placeholder="请选择开发环境默认账号"
                :clearable="true"
                :filterable="true"
                style="width: 100%"
                :options="devAccountOptions"
            />
        </n-form-item>
        <n-form-item path="beta" label="测试环境">
            <n-select
                v-model:value="envModel.beta"
                placeholder="请选择测试环境默认账号"
                :clearable="true"
                :filterable="true"
                style="width: 100%"
                :options="betaAccountOptions"
            />
        </n-form-item>
        <n-form-item path="prod" label="生产环境">
            <n-select
                v-model:value="envModel.prod"
                placeholder="请选择生产环境默认账号"
                :clearable="true"
                :filterable="true"
                style="width: 100%"
                :options="prodAccountOptions"
            />
        </n-form-item>
        <n-form-item path="setting.pubkey" label="公钥">
            <n-input
                v-model:value="envModel.setting.pubkey"
                type="textarea"
                placeholder="请输入公钥，用于加密账号密码"
                :rows="4"
                @keydown.enter.prevent
            />
        </n-form-item>
        <n-form-item path="setting.incognito" label="是否隐私窗口打开新标签页">
            <n-switch v-model:value="envModel.setting.incognito">
                <template #checked> 隐私窗口打开 </template>
                <template #unchecked> 非隐私窗口打开 </template>
            </n-switch>
        </n-form-item>
        <n-form-item path="setting.debug" label="是否调试模式">
            <n-switch v-model:value="envModel.setting.debug"> </n-switch>
        </n-form-item>
        <n-flex justify="center">
            <n-popconfirm
                @positive-click="clearAllData()"
                negative-text="取消"
                positive-text="确定"
            >
                确定清空全部数据吗？
                <template #trigger>
                    <n-button type="warning">清空全部数据</n-button>
                </template>
            </n-popconfirm>
            <n-button style="width: 250px" type="primary" @click="handleSubmit"
                >提交</n-button
            >
        </n-flex>
    </n-form>
</template>

<script lang="ts" setup>
import {
    NForm,
    NFormItem,
    NSelect,
    NButton,
    NSwitch,
    NFlex,
    NInput,
    NPopconfirm
} from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { omit } from 'lodash'
import { Account } from '../types'
import { useSwitcherStore } from '../store/switcher'
import { DefaultAccount, Setting } from '../lib/dataStorage'
import { createDiscreteApi } from 'naive-ui'
import { globalEmitter, clearAllData } from '../utils/utils'

const switcherStore = useSwitcherStore()
const { message } = createDiscreteApi(['message'])

type EnvModel = DefaultAccount & {
    setting: Setting
}

const formRef = ref()
const envModel = ref<EnvModel>({
    dev: '',
    beta: '',
    prod: '',
    setting: {
        incognito: false,
        debug: false,
        pubkey: ''
    }
})

onMounted(() => {
    envModel.value = {
        ...switcherStore.defaultAccount,
        setting: switcherStore.settings
    }
})
const devAccountOptions = computed(() =>
    switcherStore.devAccounts.map((account: Account) => ({
        label: `${account.defaultSubAccount?.enterpriseName} (${account.account})`,
        value: account.userId
    }))
)

const betaAccountOptions = computed(() =>
    switcherStore.betaAccounts.map((account: Account) => ({
        label: `${account.defaultSubAccount?.enterpriseName} (${account.account})`,
        value: account.userId
    }))
)

const prodAccountOptions = computed(() =>
    switcherStore.prodAccounts.map((account: Account) => ({
        label: `${account.defaultSubAccount?.enterpriseName} (${account.account})`,
        value: account.userId
    }))
)

const handleSubmit = () => {
    const accountData = omit(envModel.value, ['setting'])
    switcherStore.setDefaultAccount(accountData)
    switcherStore.setSettings(envModel.value.setting)
    message.success('环境设置已保存')
    globalEmitter.emit('closeManage')
}
</script>

<style scoped></style>
