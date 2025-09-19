<template>
    <div class="account-table">
        <n-data-table
            remote
            :max-height="170"
            :columns="columns"
            :data="switcherStore.accounts"
            :paging="false"
            :loading="loading"
        />
    </div>
</template>

<script lang="ts" setup>
import { NTag, NButton, NSpace, NDataTable, NPopconfirm } from 'naive-ui'
import { createDiscreteApi } from 'naive-ui'
import { onMounted, ref, h } from 'vue'
import { Account, EnvTagType } from '../types'
import { globalEmitter } from '../utils/utils'
import { useSwitcherStore } from '../store/switcher'

const { message } = createDiscreteApi(['message'])
const switcherStore = useSwitcherStore()

const accounts = ref<Account[]>([])
const columns = [
    {
        title: '账号名',
        key: 'name',
        align: 'center' as const
    },
    {
        title: '账号',
        key: 'account',
        align: 'center' as const
    },
    {
        title: '密码',
        key: 'password',
        align: 'center' as const
    },
    {
        title: '环境',
        key: 'env',
        align: 'center' as const,
        render: (row: Account) => {
            return h(NSpace, { justify: 'space-evenly', size: 'small' }, () =>
                row.env.map(env =>
                    h(
                        NTag,
                        { type: EnvTagType[env], size: 'medium' },
                        { default: () => env }
                    )
                )
            )
        }
    },
    {
        title: '操作',
        key: 'actions',
        minWidth: 200,
        align: 'center' as const,
        render: (row: Required<Account>) => {
            return h(NSpace, { justify: 'space-evenly' }, () => [
                h(
                    NButton,
                    {
                        size: 'small',
                        strong: true,
                        secondary: true,
                        type: 'info',
                        onClick: (e: Event) => {
                            e.stopPropagation()
                            globalEmitter.emit('edit-account', row)
                        }
                    },
                    { default: () => '修改' }
                ),
                h(
                    NPopconfirm,
                    {
                        onPositiveClick: (e: Event) => {
                            e.stopPropagation()
                            deleteAccount(row.id)
                        },
                        positiveText: '确认删除',
                        negativeText: '取消'
                    },
                    {
                        trigger: () =>
                            h(
                                NButton,
                                {
                                    size: 'small',
                                    strong: true,
                                    secondary: true,
                                    type: 'error'
                                },
                                { default: () => '删除' }
                            ),
                        default: () => '确定要删除这个账号吗？'
                    }
                )
            ])
        }
    }
]
const loading = ref(false)

onMounted(async () => {
    loading.value = true
    accounts.value = switcherStore.accounts
    loading.value = false
})

const deleteAccount = (id: string) => {
    globalEmitter.emit('delete-account', id)
    switcherStore.deleteAccountById(id) && message.success('账号删除成功')
}
</script>

<style scoped>
.account-table {
    margin-top: 20px;
}
</style>
