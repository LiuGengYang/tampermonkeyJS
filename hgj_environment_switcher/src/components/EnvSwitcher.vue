<script setup lang="ts">
import SwitchBtn from './SwitchBtn.vue'
import AccountManage from './AccountManage.vue'
import { globalEmitter } from '../utils/utils'
import { useDraggable } from '../composables/useDraggable'
import { ref, onMounted } from 'vue'

const switcher = ref<HTMLElement | null>(null)
const envSwitcherBtn = ref<HTMLElement | null>(null)
const accountManage = ref<any>(null)
const switchBtn = ref()

// 使用拖拽 composable
const { pos, optionsShow, dragStart, handleClick, showDialog } = useDraggable({
    switcher,
    envSwitcherBtn
})

onMounted(() => {
    globalEmitter.on('addNewByEnv', () => {
        optionsShow.value = false
        showDialog(accountManage)
    })
})
</script>

<template>
    <div
        ref="switcher"
        class="env-switcher"
        :style="{ left: pos.x + 'px', top: pos.y + 'px' }"
    >
        <div
            ref="envSwitcherBtn"
            class="env-switcher-btn"
            @mousedown.stop="dragStart"
            @click.stop="
                () => {
                    handleClick()
                }
            "
        >
            <svg
                t="1757574763114"
                class="icon"
                viewBox="0 0 1024 1024"
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
                p-id="6581"
                width="20"
                height="20"
            >
                <path
                    d="M738.56 168.192l116.48 116.8a128 128 0 0 1 37.248 84.288l0.64 14.72A61.12 61.12 0 0 1 832 448H192a64 64 0 1 1 0-128h517.504l-61.312-61.376a64 64 0 0 1 90.432-90.432zM285.44 850.688l-116.48-116.864a128 128 0 0 1-37.248-84.288l-0.64-14.72a61.12 61.12 0 0 1 60.992-64H832a64 64 0 0 1 0 128l-517.504 0.064 61.312 61.376a64 64 0 0 1-90.432 90.432z"
                    fill="#ffffff"
                    p-id="6582"
                    data-spm-anchor-id="a313x.search_index.0.i1.28003a81ISwaJq"
                    class="selected"
                ></path>
            </svg>
        </div>
        <div
            class="account-icon"
            @mousedown.stop
            @click.stop="showDialog(accountManage)"
        >
            <svg
                t="1758098433552"
                class="icon"
                viewBox="0 0 1024 1024"
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
                p-id="17033"
                width="25"
                height="25"
            >
                <path
                    d="M757.700755 776.680844c0.036125-0.296225 0.065025-0.59245 0.0867-0.895901C757.65018 775.893318 757.570705 776.088393 757.700755 776.680844z"
                    fill="#4C79ED"
                    p-id="17034"
                ></path>
                <path
                    d="M661.030184 417.583631c0-88.116165-71.440852-159.557017-159.549792-159.557017-88.116165 0-159.549792 71.440852-159.549792 159.557017 0 88.145065 71.433627 159.549792 159.549792 159.549792C589.589332 577.140648 661.030184 505.728695 661.030184 417.583631z"
                    fill="#4C79ED"
                    p-id="17035"
                ></path>
                <path
                    d="M757.787455 775.784943c0.007225-0.007225 0.01445-0.021675 0.021675-0.0289l0.093925-1.069301C757.89583 775.055218 757.816355 775.416468 757.787455 775.784943z"
                    fill="#4C79ED"
                    p-id="17036"
                ></path>
                <path
                    d="M501.545417 7.225005C224.545939 7.225005 0 231.770945 0 508.770423c0 276.977803 224.545939 501.516517 501.545417 501.516517 276.992253 0 501.538192-224.538714 501.538192-501.516517C1003.08361 231.770945 778.53767 7.225005 501.545417 7.225005zM757.715205 776.832569c-0.021675-0.079475 0-0.0867-0.01445-0.151725-0.989826 7.44898-7.282805 13.185635-14.999111 13.185635-8.409906 0-15.880562-6.777055-15.880562-15.186961-29.297396-96.706696-119.060862-167.150497-225.333465-167.150497-106.279828 0-196.484019 73.803429-225.78864 170.524575l0.411825-3.374077c0 10.078882-10.042757 15.186961-15.851662 15.186961-8.402681 0-15.194186-6.777055-15.194186-15.186961 0.4046-1.640076 0.50575-3.244027 0.968151-4.913004 0.151725-0.411825 0.21675-0.859776 0.3757-1.271601 24.817893-84.922712 90.637691-152.332012 174.780103-178.963381-64.721597-30.279997-109.64668-95.78912-109.64668-171.955126 0-104.878177 85.031087-189.945389 189.945389-189.945389 104.878177 0 189.938164 85.059987 189.938164 189.945389 0 76.166006-44.968433 141.675129-109.668355 171.940676 84.142412 26.63137 149.954985 94.055119 174.772878 178.963381 0.180625 0.411825 1.242701 5.787229 1.365526 6.19183 0.238425 0.830876 0.07225 0.946476-0.093925 1.069301L757.715205 776.832569z"
                    fill="#4C79ED"
                    p-id="17037"
                ></path>
            </svg>
        </div>
        <SwitchBtn
            v-model:show="optionsShow"
            :parentPos="pos"
            ref="switchBtn"
        />
    </div>
    <AccountManage ref="accountManage" />
</template>

<style scoped>
.env-switcher {
    position: fixed;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    color: white;
    font-weight: bold;
    cursor: move;
    z-index: 99999999;
    user-select: none;
}

.env-switcher-btn {
    width: 40px;
    height: 40px;
    background-color: #4285f4;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    box-shadow: 0 3px 12px rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(5px);
    border: 2px solid rgba(255, 255, 255, 0.3);
    cursor: pointer;
    position: absolute;
    left: 0;
    top: 0;
    z-index: 99999;
}

.account-icon {
    position: absolute;
    right: -60px;
    top: -15px;
    cursor: pointer;
}
</style>
