<template>
    <n-modal
        preset="dialog"
        transform-origin="center"
        :show-icon="false"
        v-model:show="dialogVisible"
        style="min-width: 700px"
        :z-index="2004"
    >
        <div class="modal-content">
            <n-tabs
                v-model:value="tabActive"
                type="line"
                size="large"
                animated
                :tabs-padding="20"
                justify-content="space-evenly"
            >
                <n-tab-pane name="账号列表">
                    <div class="tab-content">
                        <AccountForm
                            @switch-tab="
                                tabName => {
                                    tabActive = tabName
                                }
                            "
                        />
                        <AccountTable />
                    </div>
                </n-tab-pane>
                <n-tab-pane name="环境设置">
                    <div class="tab-content">
                        <EnvironmentForm />
                    </div>
                </n-tab-pane>
            </n-tabs>
        </div>
    </n-modal>
</template>

<script lang="ts" setup>
import { NModal, NTabs, NTabPane } from 'naive-ui'
import { onMounted, ref, watch } from 'vue'
import AccountForm from './AccountForm.vue'
import AccountTable from './AccountTable.vue'
import EnvironmentForm from './EnvironmentForm.vue'
import { globalEmitter } from '../utils/utils'

const dialogVisible = ref(false)
const tabActive = ref('账号列表')

watch(dialogVisible, val => !val && (tabActive.value = '账号列表'))

onMounted(() => {
    globalEmitter.on('closeManage', () => {
        dialogVisible.value = false
    })
})

const openDialog = () => {
    dialogVisible.value = true
}

defineExpose({
    openDialog
})
</script>

<style scoped>
.modal-content {
    min-width: 600px;
}

.tab-content {
    width: 600px;
    height: 500px;
    padding: 0 20px;
}
</style>
