import { GM_cookie, unsafeWindow } from '$'
import mitt, { type Emitter } from 'mitt'
import { Env } from '../types'

export function isInIframe() {
    try {
        return window.self !== window.top
    } catch (e) {
        // 如果出现跨域错误，说明在 iframe 中
        return true
    }
}

export function guid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
        /[xy]/g,
        function (c) {
            var r = (Math.random() * 16) | 0,
                v = c == 'x' ? r : (r & 0x3) | 0x8
            return v.toString(16)
        }
    )
}

export function getCurrentEnvironment() {
    const hostname = window.location.hostname
    if (hostname.includes('dev') || hostname.includes('localhost')) {
        return 'dev'
    } else if (hostname.includes('beta') || hostname.includes('test')) {
        return 'beta'
    } else {
        return 'prod'
    }
}

export function processUrl(env: Env): string {
    const currentUrl =
        window.location.href.includes('localhost:') || env === 'prod'
            ? 'https://eyun.hgj.com/login'
            : window.location.href
    const url = new URL(currentUrl)
    if (env !== 'prod') {
        let hostname = url.hostname
        const dashIndex = hostname.indexOf('-')
        dashIndex != -1
            ? (hostname = env + hostname.substring(dashIndex))
            : (hostname = env + '-' + hostname)
        url.hostname = hostname
    }
    return url.toString()
}

export function clearHGJCookie() {
    const cookies = document.cookie ? document.cookie.split(';') : []
    for (let i = 0; i < cookies.length; i++) {
        if (!cookies[i].includes('hgj')) continue
        const cookie = cookies[i]
        const eqPos = cookie.indexOf('=')
        const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie
        GM_cookie.delete({ name })
    }
}

export function logOut() {
    if (unsafeWindow) {
        clearHGJCookie()
        ;(document.getElementById('app') as any)?.__vue__?.$store?.commit(
            'logout'
        )
        window.location.href = window.location.origin + '/login'
    }
}

export function fillInAccount(accountInfo: {
    account: string
    password: string
}) {
    const { account, password } = accountInfo
    // 查找用户名输入框 - 排除区号选择框和短输入框
    const allTextInputs = Array.from(
        document.querySelectorAll(
            'input[type="text"], input[type="email"], input:not([type])'
        )
    ) as HTMLInputElement[]
    const usernameInputs = allTextInputs.filter((input: HTMLInputElement) => {
        // 排除区号相关的输入框
        if (
            input.value === '+86' ||
            input.value === '86' ||
            input.placeholder === '+86'
        ) {
            return false
        }
        // 排除太短的输入框（通常是区号框）
        if (input.offsetWidth < 100) {
            return false
        }
        // 排除disabled或readonly的输入框
        if (input.disabled || input.readOnly) {
            return false
        }
        // 优先选择有用户名相关属性的输入框
        const name = (input.name || '').toLowerCase()
        const id = (input.id || '').toLowerCase()
        const placeholder = (input.placeholder || '').toLowerCase()
        const className = (input.className || '').toLowerCase()

        // 排除明确是区号的输入框
        if (
            name.includes('code') ||
            id.includes('code') ||
            placeholder.includes('区号') ||
            className.includes('code')
        ) {
            return false
        }

        return true
    })

    const passwordInputs = Array.from(
        document.querySelectorAll('input[type="password"]')
    ) as HTMLInputElement[]

    // 尝试填充用户名
    if (usernameInputs.length > 0) {
        // 优先选择包含用户名相关关键词的输入框
        let usernameInput = usernameInputs.find(input => {
            const name = (input.name || '').toLowerCase()
            const id = (input.id || '').toLowerCase()
            const placeholder = (input.placeholder || '').toLowerCase()

            return (
                name.includes('username') ||
                name.includes('user') ||
                name.includes('account') ||
                id.includes('username') ||
                id.includes('user') ||
                id.includes('account') ||
                placeholder.includes('用户名') ||
                placeholder.includes('账号') ||
                placeholder.includes('手机号') ||
                placeholder.includes('邮箱')
            )
        })

        // 如果没找到特定的，使用第一个
        if (!usernameInput) {
            usernameInput = usernameInputs[0]
        }
        usernameInput.value = account
        // 触发input事件，以便可能的表单验证能够识别到值的变化
        usernameInput.dispatchEvent(new Event('input', { bubbles: true }))
        usernameInput.dispatchEvent(new Event('change', { bubbles: true }))
    }

    // 尝试填充密码
    if (passwordInputs.length > 0) {
        const passwordInput = passwordInputs[0]
        passwordInput.value = password
        // 触发input事件
        passwordInput.dispatchEvent(new Event('input', { bubbles: true }))
        passwordInput.dispatchEvent(new Event('change', { bubbles: true }))
    }
}

export function clickLoginBtn() {
    const loginButtons = document.querySelectorAll('.login-btn')
    console.log(loginButtons.length)
    if (loginButtons.length >= 1) {
        const loginButton = loginButtons[0] as HTMLElement
        // 检查元素是否可见和可点击
        if (loginButton.offsetParent !== null) {
            // 模拟点击事件
            loginButton.click()
            // 也触发其他可能的事件
            loginButton.dispatchEvent(new Event('mousedown', { bubbles: true }))
            loginButton.dispatchEvent(new Event('mouseup', { bubbles: true }))
            loginButton.dispatchEvent(new Event('click', { bubbles: true }))
        }
    } else {
        document.querySelectorAll('article')[1]
        let btns = document.querySelectorAll('article')
        btns.forEach(item => {
            if (item.textContent?.includes('登录')) {
                ;(item as HTMLElement).click()
            }
        })
    }
}

const emitter: Emitter<any> = mitt<any>()

export const globalEmitter = emitter
