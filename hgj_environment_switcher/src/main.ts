import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './styles/isolation.css'
import { isInIframe } from './utils/utils'
import { GM_listValues, GM_deleteValue } from '$'

// 确保只挂载一次，且不在 iframe 中
if (!isInIframe() && !document.getElementById('hgj-env-switcher-root')) {
    // 创建一个独立的容器，避免影响页面布局
    const container = document.createElement('div')
    container.id = 'hgj-env-switcher-root'
    // 设置容器样式，确保不影响页面布局
    container.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 0 !important;
    height: 0 !important;
    pointer-events: none !important;
    z-index: 999999 !important;
    overflow: visible !important;
`

    // 添加一个样式隔离的包装器
    const wrapper = document.createElement('div')
    wrapper.className = 'hgj-env-switcher-wrapper'
    wrapper.style.cssText = `
    position: relative !important;
    pointer-events: auto !important;
`

    container.appendChild(wrapper)
    document.body.appendChild(container)
    const app = createApp(App)
    app.use(createPinia())
    app.mount(wrapper)
    console.log('环境切换器已加载')
    console.log(GM_listValues())
    // GM_deleteValue('hgj_env_switcher_data')
    // GM_deleteValue('hgj_env_switcher_position')
    // GM_deleteValue('hgj_env_switcher_default_account')
    // GM_deleteValue('hgj_env_switcher_settings')
}
