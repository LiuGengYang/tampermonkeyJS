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
    const currentUrl = window.location.href
    const url = new URL(currentUrl)
    let hostname = url.hostname
    const dashIndex = hostname.indexOf('-')
    dashIndex != -1
        ? (hostname = env + hostname.substring(dashIndex))
        : (hostname = env + '-' + hostname)
    url.hostname = hostname
    return url.toString()
}

export function clearHGJCookie() {
    const cookies = document.cookie ? document.cookie.split(';') : [];
    for (let i = 0; i < cookies.length; i++) {
        if (!cookies[i].includes('hgj')) continue;
        const cookie = cookies[i];
        const eqPos = cookie.indexOf('=');
        const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
        GM_cookie.delete({ name });
    }
}

export function logOut() {
    if (unsafeWindow) {
        (document.getElementById("app") as any)?.__vue__?.$store?.commit('logout')
        window.location.href = window.location.origin + '/login';
    }
}

const emitter: Emitter<any> = mitt<any>()

export const globalEmitter = emitter
