import { GM_cookie, unsafeWindow, GM_xmlhttpRequest } from '$'
import mitt, { type Emitter } from 'mitt'
import { Env } from '../types'
import JSEncrypt from 'jsencrypt'
import { useSwitcherStore } from '../store/switcher'

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
    data?: BodyInit | undefined
): Promise<T> {
    return new Promise((resolve, reject) => {
        const switcherStore = useSwitcherStore()
        const env = switcherStore.currentEnv
        GM_xmlhttpRequest({
            fetch: true,
            method: method,
            data: data,
            url: urlHead[env as Env] + url,
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

export function chooseSubAccount(account: string) {
    const labelList: NodeListOf<HTMLLabelElement> = document.querySelectorAll(
        '.el-radio-group label'
    )
    Array.from(labelList)
        .find(item => item.title === account)
        ?.click()
    // const btns: NodeListOf<HTMLLabelElement> =
    //     document.querySelectorAll('.base-btn')
    // btns[1].click()
}
