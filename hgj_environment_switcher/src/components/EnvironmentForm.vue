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
        <n-form-item path="test" label="测试环境">
            <n-select
                v-model:value="envModel.test"
                placeholder="请选择测试环境默认账号"
                :clearable="true"
                :filterable="true"
                style="width: 100%"
                :options="testAccountOptions"
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
        <n-form-item path="setting.incognito" label="同环境下切换账号">
            <n-switch v-model:value="envModel.setting.incognito">
                <template #checked> 隐私窗口打开 </template>
                <template #unchecked> 非隐私窗口打开 </template>
            </n-switch>
        </n-form-item>
        <n-flex justify="center">
            <n-button style="width: 250px" type="primary" @click="handleSubmit"
                >提交</n-button
            >
        </n-flex>
    </n-form>
</template>

<script lang="ts" setup>
import { NForm, NFormItem, NSelect, NButton, NSwitch, NFlex } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { omit } from 'lodash'
import { Account } from '../types'
import { useSwitcherStore } from '../store/switcher'
import { DefaultAccount, Setting } from '../lib/dataStorage'
import { createDiscreteApi } from 'naive-ui'

const switcherStore = useSwitcherStore()
const { message } = createDiscreteApi(['message'])

type EnvModel = DefaultAccount & {
    setting: Setting
}

const formRef = ref()
const envModel = ref<EnvModel>({
    dev: '',
    test: '',
    prod: '',
    setting: {
        incognito: false
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
        label: `${account.name} (${account.account})`,
        value: account.id
    }))
)

const testAccountOptions = computed(() =>
    switcherStore.testAccounts.map((account: Account) => ({
        label: `${account.name} (${account.account})`,
        value: account.id
    }))
)

const prodAccountOptions = computed(() =>
    switcherStore.prodAccounts.map((account: Account) => ({
        label: `${account.name} (${account.account})`,
        value: account.id
    }))
)

const handleSubmit = () => {
    const accountData = omit(envModel.value, ['setting'])
    switcherStore.setDefaultAccount(accountData)
    switcherStore.setSettings(envModel.value.setting)
    message.success('环境设置已保存')
}
</script>

<style scoped></style>
