<template>
    <n-spin :show="loading">
        <n-form
            size="small"
            label-placement="left"
            label-width="80"
            ref="formRef"
            :model="accountModel"
            :rules="rules"
        >
            <n-form-item path="name" label="账号名称">
                <n-input
                    v-model:value="accountModel.name"
                    placeholder="请输入账号名称"
                    @keydown.enter.prevent
                />
            </n-form-item>
            <n-form-item path="account" label="账号">
                <n-input
                    v-model:value="accountModel.account"
                    placeholder="请输入账号"
                    @keydown.enter.prevent
                />
            </n-form-item>
            <n-form-item path="password" label="密码">
                <n-input
                    v-model:value="accountModel.password"
                    placeholder="请输入密码"
                    @keydown.enter.prevent
                />
            </n-form-item>
            <n-form-item path="env" label="所属环境">
                <n-checkbox-group v-model:value="accountModel.env">
                    <n-space>
                        <n-checkbox value="dev">开发环境</n-checkbox>
                        <n-checkbox value="beta">测试环境</n-checkbox>
                        <n-checkbox value="prod">生产环境</n-checkbox>
                    </n-space>
                </n-checkbox-group>
            </n-form-item>
            <n-space justify="end">
                <n-button
                    type="primary"
                    style="width: 150px"
                    @click="saveAccount"
                    >保存</n-button
                >
                <n-button
                    v-if="accountModel.id"
                    type="default"
                    style="width: 150px"
                    @click="clear(true)"
                    >取消修改</n-button
                >
                <n-button type="warning" style="width: 150px" @click="clear()"
                    >清空</n-button
                >
            </n-space>
        </n-form>
    </n-spin>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import { createDiscreteApi } from 'naive-ui'
import { guid } from '../utils/utils'
import { debounce } from 'lodash'
import { globalEmitter } from '../utils/utils'
import { useSwitcherStore } from '../store/switcher'
import {
    NForm,
    NFormItem,
    NInput,
    NButton,
    NCheckboxGroup,
    NCheckbox,
    NSpace
} from 'naive-ui'
import { Account } from '../types'

const { message } = createDiscreteApi(['message'])
const switcherStore = useSwitcherStore()

const loading = ref(false)

const accountModel = ref<Account>({
    id: '',
    name: '',
    account: '',
    password: '',
    env: []
})

const formRef = ref()

const rules = {
    name: {
        required: true,
        message: '请输入账号名',
        trigger: ['input', 'blur']
    },
    account: {
        required: true,
        message: '请输入账号',
        trigger: ['input', 'blur']
    },
    password: {
        required: true,
        message: '请输入密码',
        trigger: ['input', 'blur']
    },
    env: {
        type: 'array' as const,
        required: true,
        message: '请选择所属环境',
        trigger: ['change', 'blur']
    }
}

onMounted(() => {
    globalEmitter.on('edit-account', (account: Account) => {
        accountModel.value = { ...account }
    })
    globalEmitter.on('delete-account', (id: string) => {
        accountModel.value.id === id && clear(true)
    })
})

const saveAccount = debounce(() => {
    formRef.value?.validate(async (errors: Error) => {
        if (!errors) {
            loading.value = true
            if (!accountModel.value.id) {
                const newAccount = Object.assign({}, accountModel.value, {
                    id: guid()
                })
                switcherStore.addNewAccount(newAccount) &&
                    message.success('账号新增成功')
            } else {
                switcherStore.upDataAccountById(
                    accountModel.value.id,
                    accountModel.value as Required<Account>
                ) && message.success('账号修改成功')
            }
            clear(true)
        } else {
            message.warning('请检查表单填写是否正确')
        }
    })
    loading.value = false
}, 300)

const clear = (clearAll = false) => {
    accountModel.value = Object.assign(
        {
            name: '',
            account: '',
            password: '',
            env: []
        },
        accountModel.value.id && !clearAll ? { id: accountModel.value.id } : {}
    )
}
</script>

<style scoped></style>
