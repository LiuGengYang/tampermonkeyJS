import {
    GM_cookie,
    unsafeWindow,
    GM_xmlhttpRequest,
    GM_listValues,
    GM_deleteValue
} from '$'
import mitt, { type Emitter } from 'mitt'
import { Env } from '../types'
import JSEncrypt from 'jsencrypt'
import { useSwitcherStore } from '../store/switcher'

// 日志函数，根据设置决定是否输出
function log(message: string, ...optionalParams: any[]) {
    const switcherStore = useSwitcherStore()

    // 检查是否是生产环境
    const isProduction = import.meta.env.MODE === 'production'

    // 如果是生产环境且没有开启日志，则不输出
    if (isProduction && !switcherStore.settings.enableLogs) {
        return
    }

    // 检查设置中的日志开关
    if (switcherStore.settings.enableLogs) {
        console.log(message, ...optionalParams)
    }
}

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

/**
 * 持续监听指定 url 的接口响应
 * @param url 需要监听的 url（支持部分匹配）
 * @param handler 每次响应回调 (data) => void
 * @returns { stop: () => void }
 */
type InterceptedRequest = {
    kind: 'fetch' | 'xhr'
    url: string
    method?: string
    headers?: Record<string, string>
    body?: any
    query?: Record<string, string>
}

export function interceptSaasTenantLoginResponse(
    url: string,
    handler: (data: any, request?: InterceptedRequest) => void
) {
    // 监听来自页面注入脚本的消息（持续，不自动移除）
    const msgListener = (ev: MessageEvent) => {
        const msg = ev.data
        if (!msg || msg.__tampermonkey_login_intercept !== true) return
        const { stage, info, request } = msg.payload || {}
        const reqUrl = (info?.url || '').toString()
        if (reqUrl.includes(url) && stage === 'response') {
            try {
                const responseData =
                    info.responseData || info.body || info.response
                if (typeof responseData === 'string') {
                    try {
                        handler(JSON.parse(responseData), request)
                    } catch {
                        handler(responseData, request)
                    }
                } else {
                    handler(responseData, request)
                }
            } catch (_e) {
                // 单次解析错误忽略
            }
        }
    }
    window.addEventListener('message', msgListener, false)

    // 注入页面脚本拦截 fetch 和 XHR（仅注入一次）
    try {
        if (!(window as any).__tampermonkey_login_hook_installed) {
            const script = document.createElement('script')
            script.type = 'text/javascript'
            script.textContent = `
(function(){
    if (window.__tampermonkey_login_hook_installed) return;
    window.__tampermonkey_login_hook_installed = true;

    function post(payload){
        try {
            window.postMessage({ __tampermonkey_login_intercept: true, payload }, '*');
        } catch(e) {}
    }

    function headersToObject(h) {
        try {
            const obj = {};
            if (!h) return obj;
            if (h instanceof Headers) {
                h.forEach((v, k) => { obj[k] = v; });
            } else if (Array.isArray(h)) {
                for (const [k, v] of h) obj[k] = v;
            } else if (typeof h === 'object') {
                for (const k in h) obj[k] = h[k];
            }
            return obj;
        } catch(_) { return {}; }
    }

    function normalizeBody(body) {
        try {
            if (body == null) return undefined;
            if (typeof body === 'string') return body;
            if (body instanceof URLSearchParams) return body.toString();
            if (typeof FormData !== 'undefined' && body instanceof FormData) {
                const obj = {};
                for (const [k, v] of body.entries()) obj[k] = v;
                return JSON.stringify(obj);
            }
            if (typeof body === 'object') return JSON.stringify(body);
            return String(body);
        } catch(_) { return undefined; }
    }

    function parseQuery(u) {
        try {
            const urlObj = new URL(u, window.location.href);
            const out = {};
            urlObj.searchParams.forEach((v, k) => { out[k] = v; });
            return out;
        } catch(_) { return {}; }
    }

    // Hook fetch
    const originalFetch = window.fetch;
    window.fetch = async function(input, init) {
        const url = (input && input.url) || (typeof input === 'string' ? input : '');
        const method = (init && init.method) || (input && input.method) || 'GET';
        let reqHeaders = {};
        try {
            const h1 = input && input.headers ? input.headers : undefined;
            const h2 = init && init.headers ? init.headers : undefined;
            reqHeaders = Object.assign({}, headersToObject(h1), headersToObject(h2));
        } catch(_) {}
        let bodyText;
        try {
            if (init && 'body' in (init||{}) && init.body != null) {
                bodyText = normalizeBody(init.body);
            } else if (input instanceof Request) {
                try { bodyText = await input.clone().text(); } catch(_) {}
            }
        } catch(_) {}
        const query = parseQuery(url);
        
        try {
            const response = await originalFetch.apply(this, arguments);
            
            if (url.includes('${url}')) {
                const clonedResponse = response.clone();
                try {
                    const data = await clonedResponse.text();
                    post({
                        stage: 'response',
                        info: {
                            kind: 'fetch',
                            url: url,
                            status: response.status,
                            statusText: response.statusText,
                            responseData: data
                        },
                        request: {
                            kind: 'fetch',
                            url: url,
                            method: method,
                            headers: reqHeaders,
                            body: bodyText,
                            query: query
                        }
                    });
                } catch(e) {}
            }
            
            return response;
        } catch(err) {
            throw err;
        }
    };

    // Hook XMLHttpRequest
    const OriginalXHR = window.XMLHttpRequest;
    function HookedXHR() {
        const xhr = new OriginalXHR();
        let _url = '';
        let _method = '';
        let _body;
        const _headers = {};
        
        const origOpen = xhr.open;
        xhr.open = function(method, url) {
            _method = method;
            _url = url;
            return origOpen.apply(this, arguments);
        };

        const origSetRequestHeader = xhr.setRequestHeader;
        xhr.setRequestHeader = function(name, value){
            try { _headers[name] = value; } catch(_) {}
            return origSetRequestHeader.apply(this, arguments);
        };
        
        const origSend = xhr.send;
        xhr.send = function(body) {
            _body = body;
            if (_url.includes('${url}')) {
                xhr.addEventListener('readystatechange', function() {
                    if (xhr.readyState === 4) {
                        try {
                            post({
                                stage: 'response',
                                info: {
                                    kind: 'xhr',
                                    url: _url,
                                    status: xhr.status,
                                    statusText: xhr.statusText,
                                    response: xhr.responseText
                                },
                                request: {
                                    kind: 'xhr',
                                    url: _url,
                                    method: _method,
                                    headers: _headers,
                                    body: normalizeBody(_body),
                                    query: parseQuery(_url)
                                }
                            });
                        } catch(e) {}
                    }
                });
            }
            return origSend.apply(this, arguments);
        };
        
        return xhr;
    }
    HookedXHR.prototype = OriginalXHR.prototype;
    window.XMLHttpRequest = HookedXHR;
})();
            `
            document.documentElement.appendChild(script)
            ;(window as any).__tampermonkey_login_hook_installed = true
        }
    } catch (_e) {
        // 注入失败（如 CSP），忽略
    }

    return {
        stop() {
            window.removeEventListener('message', msgListener, false)
        }
    }
}

/**
 * 使用 RSA 公钥加密数据
 *
 * @export
 * @param {string} data
 * @return {string | false} 加密后的字符串，失败返回 false
 */
export function encrypt(data: string) {
    const encrypt = new JSEncrypt()
    const switcherStore = useSwitcherStore()
    encrypt.setPublicKey(switcherStore.settings.pubkey)
    return encrypt.encrypt(data)
}

type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
enum urlHead {
    dev = 'https://dev-apisix.hgj.com/',
    beta = 'https://beta-apisix.hgj.com/',
    prod = 'https://ingress-ng.hgj.com/'
}

/**
 * 通用的 GM_xmlhttpRequest 封装
 *
 * @export
 * @param {RequestMethod} method
 * @param {string} url
 * @param {BodyInit | undefined} [data]
 * @return {*}
 */
export function fetch<T>(
    method: RequestMethod,
    url: string,
    data?: BodyInit | undefined,
    env?: Env
): Promise<T> {
    return new Promise((resolve, reject) => {
        const switcherStore = useSwitcherStore()
        const currentEnv = switcherStore.currentEnv

        GM_xmlhttpRequest({
            fetch: true,
            method: method,
            data: data,
            url: urlHead[(env as Env) || currentEnv] + url,
            headers: {
                'Content-Type': 'application/json',
                appName: 'saas_tenant_pc',
                'app-name': 'saas_tenant_pc',
                yun_saas_request_source:
                    localStorage.getItem('yun_saas_request_source') || '-1',
                'access-token':
                    (document.cookie.match(
                        new RegExp('(^| )ssoSessionId=([^;]+)')
                    ) || [])[2] || '',
                'Cache-Control': 'no-cache',
                Pragma: 'no-cache',
                'eyun-locale': (
                    localStorage.getItem('lang') ||
                    navigator.language ||
                    'zh-CN'
                ).toLowerCase(),
                source: 'saas' // 区分serp
            },
            onload: function (response) {
                if (response.status === 200) {
                    const res = JSON.parse(response.responseText)
                    if (res.success) {
                        resolve(res.data)
                    } else {
                        reject(new Error(res.msg || 'Request error'))
                    }
                } else {
                    reject(new Error('Request failed'))
                }
            },
            onerror: function () {
                reject(new Error('Network error'))
            }
        })
    })
}

/**
 * 检查子账号选择界面是否准备就绪
 * @returns {boolean} 是否准备就绪
 */
export function isSubAccountSelectorReady(): boolean {
    const radioGroup = !!document.querySelector('.el-radio-group')
    const subAccount = !!document.querySelector('[class*="subaccount"]')
    const subAccount2 = !!document.querySelector('[class*="sub-account"]')
    const enterprise = !!document.querySelector('[class*="enterprise"]')

    log('[子账号选择] 检查选择器就绪状态:', {
        '.el-radio-group': radioGroup,
        '[class*="subaccount"]': subAccount,
        '[class*="sub-account"]': subAccount2,
        '[class*="enterprise"]': enterprise
    })

    return radioGroup || subAccount || subAccount2 || enterprise
}

/**
 * 等待子账号选择界面出现
 * @param {number} timeout 超时时间（毫秒）
 * @returns {Promise<boolean>} 是否成功等待
 */
export function waitForSubAccountSelector(timeout = 5000): Promise<boolean> {
    return new Promise(resolve => {
        log(
            `[子账号选择] ========== 等待子账号选择界面出现 (超时: ${timeout}ms) ==========`
        )

        const start = Date.now()
        let checkCount = 0

        const check = () => {
            checkCount++
            const isReady = isSubAccountSelectorReady()

            if (isReady) {
                const elapsed = Date.now() - start
                log(
                    `[子账号选择] 子账号选择界面已就绪 (耗时: ${elapsed}ms, 检查次数: ${checkCount})`
                )
                resolve(true)
            } else if (Date.now() - start >= timeout) {
                log(
                    `[子账号选择] 等待超时 (${timeout}ms, 检查次数: ${checkCount})`
                )
                resolve(false)
            } else {
                setTimeout(check, 100)
            }
        }

        check()
    })
}

export function chooseSubAccount(account: string) {
    /**
     * 选择子账号的完整流程
     * 1. 先等待 DOM 更新
     * 2. 尝试多种方式选择子账号
     * 3. 点击确认按钮
     */

    log(`[子账号选择] ========== 开始选择子账号: ${account} ==========`)

    // 创建一个异步函数，可以多次尝试
    const attemptSelection = () => {
        return new Promise<boolean>(resolve => {
            log('[子账号选择] 尝试选择子账号...')

            // 策略1：使用 el-radio-group 选择器
            const radioGroup = document.querySelector('.el-radio-group')
            log(
                '[子账号选择] 查找 .el-radio-group:',
                radioGroup ? '找到' : '未找到'
            )

            const radioLabels = document.querySelectorAll(
                '.el-radio-group label'
            )
            log(`[子账号选择] 找到 ${radioLabels.length} 个 label`)

            let selected = false

            radioLabels.forEach((label, index) => {
                const text = label.textContent?.trim() || ''
                const title = (label as HTMLElement).title || ''
                log(
                    `[子账号选择] label ${index}: text="${text}", title="${title}"`
                )

                if (text === account || title === account) {
                    log(
                        `[子账号选择] 找到匹配的 label (index ${index})，准备触发事件`
                    )

                    // 标准选择
                    log('[子账号选择] 触发 label.click()')
                    ;(label as HTMLElement).click()

                    // 触发事件
                    log('[子账号选择] 触发 mousedown 事件')
                    label.dispatchEvent(
                        new Event('mousedown', { bubbles: true })
                    )
                    log('[子账号选择] 触发 mouseup 事件')
                    label.dispatchEvent(new Event('mouseup', { bubbles: true }))
                    log('[子账号选择] 触发 click 事件')
                    label.dispatchEvent(
                        new MouseEvent('click', { bubbles: true })
                    )

                    // 标记为选中状态
                    const input = label.querySelector('input[type="radio"]')
                    log(
                        '[子账号选择] 查找 radio input:',
                        input ? '找到' : '未找到'
                    )
                    if (input) {
                        log('[子账号选择] 设置 input.checked = true')
                        ;(input as HTMLInputElement).checked = true
                        log('[子账号选择] 触发 change 事件')
                        input.dispatchEvent(
                            new Event('change', { bubbles: true })
                        )
                    }

                    selected = true
                    log('[子账号选择] 策略1 选择成功')
                }
            })

            if (selected) {
                log('[子账号选择] 已成功选择子账号')
                resolve(true)
                return
            }

            // 策略2：查找包含特定文本的 label 或 div
            log(
                '[子账号选择] 策略1 失败，尝试策略2：查找所有 label 和 div'
            )
            const labels = document.querySelectorAll('label, div')
            log(`[子账号选择] 找到 ${labels.length} 个 label/div 元素`)
            labels.forEach((item, index) => {
                if (item.textContent?.trim() === account && !selected) {
                    log(
                        `[子账号选择] 策略2找到匹配元素 (index ${index})`
                    )
                    ;(item as HTMLElement).click()
                    item.dispatchEvent(
                        new MouseEvent('click', { bubbles: true })
                    )
                    selected = true
                    log('[子账号选择] 策略2 选择成功')
                }
            })

            // 策略3：使用 aria-label 或 title 属性
            if (!selected) {
                log(
                    '[子账号选择] 策略2 失败，尝试策略3：通过 aria-label 或 title 查找'
                )
                const ariaLabels = document.querySelectorAll(
                    '[aria-label], [title]'
                )
                log(
                    `[子账号选择] 找到 ${ariaLabels.length} 个带 aria-label/title 的元素`
                )
                ariaLabels.forEach(element => {
                    const ariaLabel =
                        (element as HTMLElement).getAttribute('aria-label') ||
                        ''
                    const title = (element as HTMLElement).title || ''

                    if (
                        ariaLabel === account ||
                        (title === account && !selected)
                    ) {
                        log(
                            `[子账号选择] 策略3找到匹配元素: aria-label="${ariaLabel}", title="${title}"`
                        )
                        ;(element as HTMLElement).click()
                        element.dispatchEvent(
                            new MouseEvent('click', { bubbles: true })
                        )
                        selected = true
                        log('[子账号选择] 策略3 选择成功')
                    }
                })
            }

            log(`[子账号选择] 选择结果: ${selected ? '成功' : '失败'}`)
            resolve(selected)
        })
    }

    // 执行选择流程
    const executeSelection = async () => {
        log('[子账号选择] ========== 开始执行选择流程 ==========')

        // 首先尝试选择子账号
        let selected = await attemptSelection()
        log(
            `[子账号选择] 子账号选择结果: ${selected ? '成功' : '失败'}`
        )

        // 如果选择成功，等待一会然后点击确认
        if (selected) {
            log('[子账号选择] 等待 300ms 后点击确认按钮...')
            setTimeout(() => {
                log('[子账号选择] 开始查找并点击确认按钮')

                let clicked = false

                // 查找确认按钮
                const confirmSelectors = [
                    '.base-btn',
                    'article.base-btn',  // 明确指定是 article 元素
                    '.submit-btn',
                    '.confirm-btn',
                    '.el-button--primary'
                ]

                // 额外查找包含"确定"文本的 article 元素（更精确的匹配）
                // 只查找短的文本，避免匹配到区号选择器中的长文本
                const articles = document.querySelectorAll('article')
                articles.forEach(article => {
                    const text = article.textContent?.trim()
                    // 只查找文本较短且包含"确定"的元素
                    if (text && text.includes('确定') && text.length < 50 && !clicked) {
                        const htmlArticle = article as HTMLElement
                        if (htmlArticle.offsetParent !== null) {
                            // 检查是否在正确的位置（不在区号选择器中）
                            const parentClasses = htmlArticle.parentElement?.className || ''
                            if (!parentClasses.includes('country') && !parentClasses.includes('area')) {
                                // 检查按钮的样式和类名
                                const hasBaseBtn = htmlArticle.classList.contains('base-btn')
                                const hasBlueClass = htmlArticle.className.includes('blue')

                                if (hasBaseBtn && hasBlueClass) {
                                    log('[子账号选择] 找到正确的确定按钮 article')
                                    log('[子账号选择] button 文本:', text)
                                    log('[子账号选择] button 类名:', htmlArticle.className)

                                    htmlArticle.click()
                                    htmlArticle.dispatchEvent(
                                        new MouseEvent('click', {
                                            bubbles: true,
                                            cancelable: true,
                                            view: window
                                        })
                                    )
                                    clicked = true
                                    log('[子账号选择] 确定 article 点击成功')
                                }
                            }
                        }
                    }
                })

                // 如果还没找到，尝试查找其他可能的确认按钮
                if (!clicked) {
                    // 查找所有可能的确认按钮
                    const allConfirmButtons = [
                        ...document.querySelectorAll('article.base-btn.blue'),
                        ...document.querySelectorAll('.base-btn'),
                        ...document.querySelectorAll('article'),
                        ...document.querySelectorAll('button')
                    ]

                    // 去重
                    const uniqueButtons = Array.from(new Set(allConfirmButtons))

                    uniqueButtons.forEach(btn => {
                        if (!clicked) {
                            const element = btn as HTMLElement
                            const text = btn.textContent?.trim()

                            // 检查元素是否可见且文本简短
                            if (element.offsetParent !== null &&
                                text &&
                                (text.includes('确定') || text.includes('确认')) &&
                                text.length < 50) {

                                // 额外检查：不在区号选择器中
                                const parentClasses = element.parentElement?.className || ''
                                if (!parentClasses.includes('country') && !parentClasses.includes('area')) {
                                    log('[子账号选择] 使用备用方案找到确认按钮:', text)
                                    log('[子账号选择] button 类型:', btn.tagName)
                                    log('[子账号选择] button 类名:', element.className)

                                    element.click()
                                    element.dispatchEvent(
                                        new MouseEvent('click', {
                                            bubbles: true,
                                            cancelable: true,
                                            view: window
                                        })
                                    )
                                    clicked = true
                                    log('[子账号选择] 备用确认按钮点击成功')
                                }
                            }
                        }
                    })
                }

                confirmSelectors.forEach(selector => {
                    if (clicked) return

                    try {
                        log(`[子账号选择] 尝试选择器: ${selector}`)
                        const buttons = document.querySelectorAll(selector)
                        log(
                            `[子账号选择] 找到 ${buttons.length} 个按钮`
                        )

                        buttons.forEach(btn => {
                            const htmlBtn = btn as HTMLElement
                            const isButton = btn.tagName === 'BUTTON'
                            const isDisabled = isButton ?
                                (btn as HTMLButtonElement).disabled :
                                false

                            if (
                                !clicked &&
                                htmlBtn.offsetParent !== null &&
                                !isDisabled
                            ) {
                                log(
                                    '[子账号选择] 找到可用按钮，准备点击:',
                                    {
                                        text: btn.textContent?.trim(),
                                        tagName: btn.tagName,
                                        disabled: isDisabled,
                                        visible: htmlBtn.offsetParent !== null
                                    }
                                )

                                htmlBtn.click()
                                // 触发额外事件
                                htmlBtn.dispatchEvent(
                                    new MouseEvent('click', {
                                        bubbles: true,
                                        cancelable: true,
                                        view: window
                                    })
                                )
                                clicked = true
                                log('[子账号选择] 确认按钮点击成功')
                            }
                        })
                    } catch (e) {
                        log('[子账号选择] 选择器执行错误:', e)
                        // 忽略错误
                    }
                })

                // 备用方案：点击最后一个可用按钮（可能是确认按钮）
                if (!clicked) {
                    log(
                        '[子账号选择] 主选择器失败，尝试备用方案：点击最后一个可用按钮'
                    )

                    // 查找所有可能的确认按钮类型
                    const allButtons = Array.from(
                        document.querySelectorAll('button, article, .base-btn')
                    ).filter(btn => {
                        const htmlBtn = btn as HTMLElement
                        const isButton = btn.tagName === 'BUTTON'
                        const isDisabled = isButton ?
                            (btn as HTMLButtonElement).disabled :
                            false
                        return (
                            htmlBtn.offsetParent !== null &&
                            !isDisabled
                        )
                    })

                    log(
                        `[子账号选择] 找到 ${allButtons.length} 个可用按钮`
                    )

                    if (allButtons.length > 0) {
                        const lastBtn = allButtons[allButtons.length - 1]
                        const btnText = lastBtn.textContent?.trim()
                        log(
                            '[子账号选择] 点击最后一个按钮:',
                            btnText,
                            '类型:',
                            lastBtn.tagName
                        )

                        // 确保元素可见且可点击
                        if ((lastBtn as HTMLElement).offsetParent !== null) {
                            (lastBtn as HTMLElement).click()
                            log('[子账号选择] 备用按钮点击成功')
                        } else {
                            log('[子账号选择] 按钮不可见，跳过点击')
                        }
                    } else {
                        log('[子账号选择] 未找到任何可用按钮')
                    }
                }

                log(
                    `[子账号选择] 确认按钮点击结果: ${clicked ? '成功' : '失败'}`
                )
            }, 300)
        } else {
            log('[子账号选择] 子账号选择失败，跳过点击确认按钮')
        }
    }

    // 如果 DOM 可能还没渲染完成，使用轮询
    let attempts = 0
    const maxAttempts = 10
    const pollInterval = 100

    log('[子账号选择] 开始轮询等待 DOM 渲染...')
    const poll = () => {
        attempts++
        const radioGroupExists = !!document.querySelector('.el-radio-group')
        log(
            `[子账号选择] 轮询尝试 ${attempts}/${maxAttempts}, radioGroup 存在: ${radioGroupExists}`
        )

        if (radioGroupExists || attempts >= maxAttempts) {
            log(
                `[子账号选择] 轮询结束: ${radioGroupExists ? '找到 radioGroup' : '达到最大尝试次数'}`
            )
            executeSelection()
        } else {
            setTimeout(poll, pollInterval)
        }
    }

    poll()
    log('[子账号选择] ========== 函数执行完成 ==========')
}

export function clearAllData() {
    GM_listValues().forEach(key => {
        GM_deleteValue(key)
    })
}
