export function isInIframe() {
    try {
        return window.self !== window.top
    } catch (e) {
        // 如果出现跨域错误，说明在 iframe 中
        return true
    }
}
