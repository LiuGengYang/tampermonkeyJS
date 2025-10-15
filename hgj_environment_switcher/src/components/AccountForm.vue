<template>
    <n-spin :show="loading">
        <n-form
            v-if="switcherStore.settings.pubkey"
            size="small"
            label-placement="left"
            label-width="90"
            ref="formRef"
            :model="accountModel"
            :rules="rules"
        >
            <n-form-item
                v-if="formType === 'edit' && accountModel.userId"
                path="defaultSubAccount"
                label="默认子账号"
            >
                <n-select
                    v-model:value="defaultSubAccount"
                    placeholder="请选择默认子账号"
                    :options="subAccounts"
                    style="width: 100%"
                    label-field="enterpriseName"
                    value-field="enterpriseId"
                />
            </n-form-item>
            <n-form-item path="account" label="账号">
                <n-input
                    v-model:value="accountModel.account"
                    placeholder="请输入账号"
                    :disabled="formType === 'edit'"
                    @keydown.enter.prevent
                />
            </n-form-item>
            <n-form-item path="password" label="密码">
                <n-input
                    v-model:value="accountModel.password"
                    placeholder="请输入密码"
                    :disabled="formType === 'edit'"
                    @keydown.enter.prevent
                />
            </n-form-item>
            <n-form-item path="env" label="所属环境">
                <n-radio-group
                    v-model:value="accountModel.env"
                    name="env"
                    :disabled="formType === 'edit'"
                >
                    <n-space>
                        <n-radio value="dev"> 开发环境 </n-radio>
                        <n-radio value="beta"> 测试环境 </n-radio>
                        <n-radio value="prod"> 生产环境 </n-radio>
                    </n-space>
                </n-radio-group>
            </n-form-item>
            <n-space justify="end">
                <n-button
                    type="primary"
                    style="width: 150px"
                    @click="saveAccount"
                    >保存</n-button
                >
                <n-button
                    v-if="accountModel.userId"
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
        <n-empty v-else description="请填写公钥后使用">
            <template #extra>
                <n-button size="small" @click.stop="switchTab('环境设置')"
                    >去设置</n-button
                >
            </template>
        </n-empty>
    </n-spin>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, h, defineEmits } from 'vue'
import { createDiscreteApi } from 'naive-ui'
import { fetch, encrypt } from '../utils/utils'
import { debounce } from 'lodash'
import { globalEmitter } from '../utils/utils'
import { useSwitcherStore } from '../store/switcher'
import {
    NForm,
    NFormItem,
    NInput,
    NButton,
    NRadioGroup,
    NRadio,
    NSpace,
    NSelect,
    NSpin,
    NEmpty
} from 'naive-ui'
import { Account, subAccount } from '../types'

const emit = defineEmits(['switchTab'])

const { message, dialog } = createDiscreteApi(['message', 'dialog'])
const switcherStore = useSwitcherStore()

const loading = ref(false)
const subAccounts = ref<subAccount[]>([])
const defaultSubAccount = ref<string>()
const defaultSubAccountInfo = computed(() =>
    subAccounts.value.find(
        item => item.enterpriseId === defaultSubAccount.value
    )
)
const formType = ref<'add' | 'edit'>('add')

const accountModel = ref<
    Pick<
        Account,
        'account' | 'password' | 'env' | 'userId' | 'defaultSubAccount'
    >
>({
    account: '',
    password: '',
    env: undefined,
    userId: '',
    defaultSubAccount: undefined
})

const formRef = ref()

const rules = {
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
        required: true,
        message: '请选择所属环境',
        trigger: ['change', 'blur']
    }
}

onMounted(() => {
    globalEmitter.on('edit-account', (account: Account) => {
        formType.value = 'edit'
        accountModel.value = { ...account }
        defaultSubAccount.value =
            account.defaultSubAccount?.enterpriseId || undefined
        subAccounts.value = account.subAccount || []
    })
    globalEmitter.on('delete-account', (id: string) => {
        accountModel.value.userId === id && clear(true)
    })
})

const saveAccount = debounce(async () => {
    formRef.value?.validate(async (errors: Error) => {
        if (!errors) {
            loading.value = true
            if (!accountModel.value.userId && formType.value === 'add') {
                let data: Record<string, any> | undefined
                try {
                    const res = await fetch<{
                        loginResultResponse: Record<string, any>
                    }>(
                        'POST',
                        'saas-tenant/login',
                        JSON.stringify({
                            appName: 'saas_tenant_pc',
                            loginName: accountModel.value.account,
                            password: encrypt(accountModel.value.password),
                            rememberMe: false,
                            countryCode: '86'
                        })
                    )
                    data = res.loginResultResponse
                } catch (err) {
                    const errorMessage =
                        err instanceof Error ? err.message : String(err)
                    message.error(errorMessage)
                }
                if (data) {
                    subAccounts.value = data.enterpriseInfos
                    accountModel.value.userId = data.userId
                    openSubAccountDialog()
                }
            }
            if (accountModel.value.userId && formType.value === 'edit') {
                accountModel.value.defaultSubAccount =
                    defaultSubAccountInfo.value
                switcherStore.upDataAccountById(
                    accountModel.value.userId,
                    accountModel.value as Required<Account>
                ) && message.success('账号修改成功')
                clear(true)
                loading.value = false
            }
        } else {
            message.warning('请检查表单填写是否正确')
            loading.value = false
        }
    })
}, 300)

const clear = (clearAll = false) => {
    accountModel.value = Object.assign(
        {
            account: '',
            password: '',
            env: undefined,
            userId: '',
            defaultSubAccount: undefined
        },
        !clearAll && accountModel.value.userId
            ? { userId: accountModel.value.userId }
            : {}
    )
    subAccounts.value = []
    defaultSubAccount.value = undefined
    formType.value = 'add'
}

const openSubAccountDialog = () => {
    dialog.create({
        zIndex: 2006,
        title: '选择默认子账号',
        content: () =>
            h(NSelect, {
                style: { width: '100%', marginTop: '20px' },
                placeholder: '请选择默认子账号',
                options: subAccounts.value,
                'label-field': 'enterpriseName',
                'value-field': 'enterpriseId',
                onUpdateValue: (id: string) => {
                    defaultSubAccount.value = id
                }
            }),
        positiveText: '确定',
        closable: true,
        maskClosable: false,
        onPositiveClick: () => {
            if (defaultSubAccount.value === null) {
                message.warning('请选择默认子账号')
                return false
            }
            const newAccount = Object.assign({}, accountModel.value, {
                defaultSubAccount: defaultSubAccountInfo.value as subAccount,
                subAccount: subAccounts.value
            })
            switcherStore.addNewAccount(newAccount) &&
                message.success('账号新增成功')
            loading.value = false
            clear(true)
        }
    })
}

const switchTab = (tabName: string) => {
    emit('switchTab', tabName)
}
</script>

<style scoped></style>
