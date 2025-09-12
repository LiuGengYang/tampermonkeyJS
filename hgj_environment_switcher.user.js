// ==UserScript==
// @name         HGJ环境切换器
// @namespace    http://tampermonkey.net/
// @version      0.5.0
// @description  在eyun.hgj.com、smartai.hgj.com和login.hgj.com网站上添加环境切换按钮，支持账号密码管理和跨环境数据同步，自动填充功能
// @author       AI助手
// @match        *://*.hgj.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_addValueChangeListener
// @grant        GM_cookie
// @downloadURL  https://raw.githubusercontent.com/LiuGengYang/tampermonkeyJS/refs/heads/main/hgj_environment_switcher.user.js
// @updateURL    https://raw.githubusercontent.com/LiuGengYang/tampermonkeyJS/refs/heads/main/hgj_environment_switcher.user.js
// ==/UserScript==
(function() {
    'use strict';
    
    // 调试控制标识 - 设置为 false 可关闭所有调试输出
    const DEBUG_ENABLED = false;
    
    // 封装的日志函数
    function debugLog(...args) {
        if (DEBUG_ENABLED && window.HGJ_DEBUG_ENABLED !== false) {
            console.log('[HGJ环境切换器]', ...args);
        }
    }
    
    function debugWarn(...args) {
        if (DEBUG_ENABLED && window.HGJ_DEBUG_ENABLED !== false) {
            console.warn('[HGJ环境切换器]', ...args);
        }
    }
    
    function debugError(...args) {
        if (DEBUG_ENABLED && window.HGJ_DEBUG_ENABLED !== false) {
            console.error('[HGJ环境切换器]', ...args);
        }
    }
    
    // 等待DOM加载完成
    async function initScript() {
        // 只在指定的域名下运行脚本
        const hostname = window.location.hostname;
        if (!hostname.includes('eyun.hgj.com') && !hostname.includes('smartai.hgj.com') && !hostname.includes('login.hgj.com')) {
            return;
        }
        
        // 确保 document.body 存在
        if (!document.body) {
            debugLog('document.body 不存在，延迟执行');
            setTimeout(initScript, 100);
            return;
        }
        
        debugLog('HGJ环境切换器开始初始化...');
        
        // 数据存储封装层 - 使用GM_*函数实现跨页面数据共享
        const DataStorage = {
            // 异步获取数据
            async get(key, defaultValue = null) {
                try {
                    const value = await GM_getValue(key, defaultValue);
                    debugLog(`[DataStorage] 获取数据 ${key}:`, value);
                    return value;
                } catch (error) {
                    debugError(`[DataStorage] 获取数据失败 ${key}:`, error);
                    return defaultValue;
                }
            },
            
            // 异步设置数据
            async set(key, value) {
                try {
                    await GM_setValue(key, value);
                    debugLog(`[DataStorage] 设置数据 ${key}:`, value);
                    return true;
                } catch (error) {
                    debugError(`[DataStorage] 设置数据失败 ${key}:`, error);
                    return false;
                }
            },
            
            // 异步删除数据
            async delete(key) {
                try {
                    await GM_deleteValue(key);
                    debugLog(`[DataStorage] 删除数据 ${key}`);
                    return true;
                } catch (error) {
                    debugError(`[DataStorage] 删除数据失败 ${key}:`, error);
                    return false;
                }
            },
            
            // 监听数据变化
            addListener(key, callback) {
                try {
                    const listenerId = GM_addValueChangeListener(key, (name, oldValue, newValue, remote) => {
                        debugLog(`[DataStorage] 数据变化监听 ${key}:`, {
                            name,
                            oldValue,
                            newValue,
                            remote
                        });
                        callback(name, oldValue, newValue, remote);
                    });
                    debugLog(`[DataStorage] 添加监听器 ${key}, ID:`, listenerId);
                    return listenerId;
                } catch (error) {
                    debugError(`[DataStorage] 添加监听器失败 ${key}:`, error);
                    return null;
                }
            },
            
            // 同步获取数据（用于兼容现有代码）
            getSync(key, defaultValue = null) {
                try {
                    return GM_getValue(key, defaultValue);
                } catch (error) {
                    debugError(`[DataStorage] 同步获取数据失败 ${key}:`, error);
                    return defaultValue;
                }
            },
            
            // 同步设置数据（用于兼容现有代码）
            setSync(key, value) {
                try {
                    GM_setValue(key, value);
                    debugLog(`[DataStorage] 同步设置数据 ${key}:`, value);
                    return true;
                } catch (error) {
                    debugError(`[DataStorage] 同步设置数据失败 ${key}:`, error);
                    return false;
                }
            }
        };
        
        // 会话存储封装（仍使用sessionStorage，因为GM_*函数是全局的）
        const SessionStorage = {
            get(key, defaultValue = null) {
                try {
                    const value = sessionStorage.getItem(key);
                    return value !== null ? value : defaultValue;
                } catch (error) {
                    debugError(`[SessionStorage] 获取数据失败 ${key}:`, error);
                    return defaultValue;
                }
            },
            
            set(key, value) {
                try {
                    if (value === null || value === undefined) {
                        sessionStorage.removeItem(key);
                    } else {
                        sessionStorage.setItem(key, value);
                    }
                    debugLog(`[SessionStorage] 设置数据 ${key}:`, value);
                    return true;
                } catch (error) {
                    debugError(`[SessionStorage] 设置数据失败 ${key}:`, error);
                    return false;
                }
            },
            
            remove(key) {
                try {
                    sessionStorage.removeItem(key);
                    debugLog(`[SessionStorage] 删除数据 ${key}`);
                    return true;
                } catch (error) {
                    debugError(`[SessionStorage] 删除数据失败 ${key}:`, error);
                    return false;
                }
            }
        };
        
        // BroadcastChannel 跨域名通信
        let broadcastChannel = null;

        // 节流工具：确保 func 最多每 wait 毫秒执行一次
        function throttle(func, wait) {
            let lastTime = 0;
            let timeout = null;
            return function(...args) {
                const now = Date.now();
                const remaining = wait - (now - lastTime);
                if (remaining <= 0) {
                    if (timeout) {
                        clearTimeout(timeout);
                        timeout = null;
                    }
                    lastTime = now;
                    func.apply(this, args);
                } else if (!timeout) {
                    timeout = setTimeout(() => {
                        lastTime = Date.now();
                        timeout = null;
                        func.apply(this, args);
                    }, remaining);
                }
            };
        }
        
        // 初始化 BroadcastChannel
        function initBroadcastChannel() {
            if ('BroadcastChannel' in window) {
                broadcastChannel = new BroadcastChannel('hgj-account-sync');
                
                broadcastChannel.onmessage = async (event) => {
                    debugLog('接收到 BroadcastChannel 消息:', event.data);
                    
                    if (event.data.type === 'account_update') {
                        const { data, timestamp, origin } = event.data;
                        
                        // 避免处理自己发送的消息
                        if (origin === window.location.hostname) {
                            debugLog('跳过自己发送的消息');
                            return;
                        }
                        
                        const localTimestamp = await DataStorage.get(CROSS_ENV_SYNC_KEY);
                        if (!localTimestamp || timestamp > parseInt(localTimestamp)) {
                            debugLog(`接收到来自 ${origin} 的账号数据更新`);
                            
                            // 更新存储
                            await DataStorage.set(STORAGE_KEY, JSON.stringify(data));
                            await DataStorage.set(CROSS_ENV_SYNC_KEY, timestamp.toString());
                            
                            // 清空并重新赋值，确保引用更新
                            for (const key in accountData) {
                                delete accountData[key];
                            }
                            Object.assign(accountData, data);
                            
                            debugLog('BroadcastChannel接收后的accountData:', JSON.stringify(accountData, null, 2));
                            
                            // 刷新界面（如果当前标签页可见）
                            if (!document.hidden) {
                                setTimeout(() => {
                                    refreshUIComponents();
                                }, 50);
                            }
                            
                            debugLog('跨域名数据同步完成');
                        } else {
                            debugLog('跳过旧的同步数据');
                        }
                    }
                };
                
                debugLog('BroadcastChannel 初始化成功');
                return broadcastChannel;
            } else {
                debugWarn('BroadcastChannel 不受支持，使用备用方案');
                return null;
            }
        }
        
        // 广播数据更新到其他域名
        function broadcastDataUpdate(data) {
            if (broadcastChannel) {
                const message = {
                    type: 'account_update',
                    data: data,
                    timestamp: Date.now(),
                    origin: window.location.hostname
                };
                
                broadcastChannel.postMessage(message);
                debugLog('已广播数据更新到其他域名:', message);
            }
        }
        
        // 页面可见性变化处理
        function handleVisibilityChange() {
            debugLog('页面可见性变化:', document.hidden ? '隐藏' : '显示');
            
            if (!document.hidden) {
                // 页面变为可见时，检查并同步最新数据
                debugLog('页面变为可见，检查数据同步...');
                
                // 延迟一点时间，确保其他页面的广播消息已发送
                setTimeout(() => {
                    checkAndSyncData();
                }, 100);
            }
        }

    // 位置同步监听器已移至 switcher 创建之后，以确保元素存在后进行更新
        
        // 检查并同步数据
        async function checkAndSyncData() {
            const storedData = await DataStorage.get(STORAGE_KEY);
            const storedTimestamp = await DataStorage.get(CROSS_ENV_SYNC_KEY);
            
            if (storedData) {
                try {
                    const parsedData = JSON.parse(storedData);
                    const currentDataString = JSON.stringify(accountData);
                    const storedDataString = JSON.stringify(parsedData);
                    
                    // 检查数据是否有变化
                    if (currentDataString !== storedDataString) {
                        debugLog('检测到数据变化，同步最新数据');
                        debugLog('当前数据:', currentDataString);
                        debugLog('存储数据:', storedDataString);
                        
                        // 清空并重新赋值，确保引用更新
                        for (const key in accountData) {
                            delete accountData[key];
                        }
                        Object.assign(accountData, parsedData);
                        
                        debugLog('数据同步后的accountData:', JSON.stringify(accountData, null, 2));
                        
                        // 延迟刷新界面，确保数据已更新
                        setTimeout(() => {
                            refreshUIComponents();
                        }, 50);
                        
                        debugLog('数据同步完成，界面已更新');
                    } else {
                        debugLog('数据没有变化，无需同步');
                    }
                } catch (error) {
                    debugError('数据同步时解析失败:', error);
                }
            }
        }
        
        // 刷新所有UI组件
        function refreshUIComponents() {
            debugLog('开始刷新UI组件...');
            debugLog('当前accountData状态:', JSON.stringify(accountData, null, 2));
            
            // 刷新账号列表（如果存在）
            const accountList = document.getElementById('account-list');
            if (accountList) {
                debugLog('刷新账号列表...');
                renderAccountList();
            }
            
            // 刷新环境设置（如果存在）
            const envSettings = document.getElementById('env-settings');
            if (envSettings) {
                debugLog('刷新环境设置...');
                renderEnvironmentSettings();
            }
            
            // 刷新快速账号菜单
            const accountManagerBtn = document.querySelector('.account-manager-btn');
            if (accountManagerBtn) {
                debugLog('刷新快速账号菜单...');
                const oldMenu = accountManagerBtn.querySelector('.quick-account-menu');
                if (oldMenu) {
                    oldMenu.remove();
                }
                createQuickAccountMenu().then(newMenu => {
                    accountManagerBtn.appendChild(newMenu);
                });
            }
            
            debugLog('所有UI组件已刷新');
        }
        
        // 检查是否是通过环境切换跳转过来的
        const urlParams = new URLSearchParams(window.location.search);
        const dataSyncFlag = urlParams.get('hgj_data_sync');
        if (dataSyncFlag) {
            debugLog('检测到环境切换标识，确保数据同步:', dataSyncFlag);
        }
        
        // 账号密码存储结构 - 统一使用同一个存储键，并支持跨环境同步
        const STORAGE_KEY = 'hgj_environment_switcher_data';
        const CROSS_ENV_SYNC_KEY = 'hgj_cross_env_sync_timestamp'; // 跨环境同步时间戳
        const SESSION_ACCOUNT_KEY = 'hgj_session_account_id'; // 会话当前账号ID键名
        
        // 会话级别的当前选择账号跟踪（通过sessionStorage跨页面保持）
        let sessionCurrentAccountId = SessionStorage.get(SESSION_ACCOUNT_KEY);
        
        // 设置会话当前账号ID的辅助函数
        function setSessionCurrentAccountId(accountId) {
            sessionCurrentAccountId = accountId;
            if (accountId === null) {
                SessionStorage.remove(SESSION_ACCOUNT_KEY);
                debugLog('已清除会话当前账号');
            } else {
                SessionStorage.set(SESSION_ACCOUNT_KEY, accountId);
                debugLog(`已设置会话当前账号ID: ${accountId}`);
            }
        }
        
        // 自动填充控制标志（当用户手动选择账号后禁用自动填充）
        let autoFillEnabled = true;
        
        // 自动填充次数计数器（每个页面会话只触发一次）
        let autoFillCount = 0;
        const MAX_AUTO_FILL_COUNT = 1;
        
        // 获取基础域名（去除环境前缀）
        function getBaseDomain() {
            const hostname = window.location.hostname;
            // 移除环境前缀，获取基础域名
            if (hostname.startsWith('dev-')) {
                return hostname.substring(4);
            } else if (hostname.startsWith('beta-')) {
                return hostname.substring(5);
            }
            return hostname;
        }
        
        // 清空以hgj开头的所有cookie（使用 GM_cookie.delete）
        function clearHgjCookies() {
            debugLog('开始清空hgj相关cookie（使用 GM_cookie.delete）...');

            const cookies = document.cookie ? document.cookie.split(';') : [];
            const hgjCookieNames = [];
            cookies.forEach(cookie => {
                const cookiePair = cookie.trim();
                if (cookiePair) {
                    const [name] = cookiePair.split('=');
                    const cookieName = name.trim();
                    if (cookieName.toLowerCase().startsWith('hgj')) {
                        hgjCookieNames.push(cookieName);
                    }
                }
            });

            debugLog(`发现 ${hgjCookieNames.length} 个hgj相关cookie:`, hgjCookieNames);

            let clearedCount = 0;
            const url = window.location.href;

            hgjCookieNames.forEach(cookieName => {
                try {
                    // 删除时尽量提供 name 和 url，Tampermonkey 的 GM_cookie.delete 会基于此删除对应的 cookie
                    GM_cookie.delete({ name: cookieName, url }, function(error) {
                        if (error) {
                            debugWarn(`GM_cookie.delete 删除 ${cookieName} 返回错误:`, error);
                        } else {
                            debugLog(`GM_cookie.delete 已删除 cookie: ${cookieName}`);
                        }
                    });
                    clearedCount++;
                } catch (e) {
                    debugError('调用 GM_cookie.delete 失败:', e);
                }
            });

            // 异步验证（short delay）
            setTimeout(() => {
                const remaining = document.cookie ? document.cookie.split(';').filter(cookie => {
                    const cookiePair = cookie.trim();
                    if (cookiePair) {
                        const [name] = cookiePair.split('=');
                        return name.trim().toLowerCase().startsWith('hgj');
                    }
                    return false;
                }) : [];

                if (remaining.length > 0) {
                    debugWarn(`仍有 ${remaining.length} 个hgj cookie未清除:`, remaining);
                } else {
                    debugLog('所有hgj相关cookie已成功清除（或已请求删除）');
                }
            }, 200);

            return clearedCount;
        }
        
        // 强力清除cookie函数（使用更多变体）
        function forceClearHgjCookies() {
            debugLog('使用强力模式清除hgj相关cookie（GM_cookie.delete）...');

            const cookies = document.cookie ? document.cookie.split(';') : [];
            const baseDomain = getBaseDomain();
            const hostname = window.location.hostname;
            let clearedCount = 0;

            // 枚举更多 url / firstPartyDomain 组合以提高删除命中率
            const urlVariants = [
                window.location.href,
                window.location.origin,
                `${window.location.protocol}//${hostname}/`,
                `${window.location.protocol}//${baseDomain}/`
            ];

            cookies.forEach(cookie => {
                const cookiePair = cookie.trim();
                if (cookiePair) {
                    const [name] = cookiePair.split('=');
                    const cookieName = name.trim();

                    if (cookieName.toLowerCase().startsWith('hgj')) {
                        debugLog(`强力清除 cookie: ${cookieName}`);

                        // 尝试多个 url 变体
                        urlVariants.forEach(u => {
                            try {
                                GM_cookie.delete({ name: cookieName, url: u }, function(error) {
                                    if (error) {
                                        debugWarn(`GM_cookie.delete(${cookieName}, ${u}) 返回错误:`, error);
                                    } else {
                                        debugLog(`GM_cookie.delete 已删除 cookie: ${cookieName} (url=${u})`);
                                    }
                                });
                            } catch (e) {
                                debugError('调用 GM_cookie.delete 失败:', e);
                            }
                        });

                        // 尝试基于 firstPartyDomain（如果支持）
                        try {
                            GM_cookie.delete({ name: cookieName, firstPartyDomain: baseDomain }, function(error) {
                                if (error) {
                                    debugWarn(`GM_cookie.delete firstPartyDomain=${baseDomain} 返回错误:`, error);
                                } else {
                                    debugLog(`GM_cookie.delete 已删除 cookie: ${cookieName} (firstPartyDomain=${baseDomain})`);
                                }
                            });
                        } catch (e) {
                            // 忽略不支持该参数的情况
                        }

                        clearedCount++;
                    }
                }
            });

            // 延迟验证
            setTimeout(() => {
                const remaining = document.cookie ? document.cookie.split(';').filter(cookie => {
                    const cookiePair = cookie.trim();
                    if (cookiePair) {
                        const [name] = cookiePair.split('=');
                        return name.trim().toLowerCase().startsWith('hgj');
                    }
                    return false;
                }) : [];

                if (remaining.length > 0) {
                    debugWarn('强力清除后仍有cookie残留:', remaining);
                } else {
                    debugLog('强力清除请求已完成（或所有cookie已删除）');
                }
            }, 300);

            return clearedCount;
        }
        
        // 跨环境数据同步 - 通过postMessage实现
        function syncDataAcrossEnvironments(data) {
            const baseDomain = getBaseDomain();
            const environments = ['', 'dev-', 'beta-']; // 包括生产环境（无前缀）
            
            debugLog('开始跨环境数据同步...');
            
            environments.forEach(envPrefix => {
                const targetDomain = envPrefix + baseDomain;
                if (targetDomain !== window.location.hostname) {
                    try {
                        // 创建隐藏的iframe来与其他环境通信
                        const iframe = document.createElement('iframe');
                        iframe.style.display = 'none';
                        iframe.src = `${window.location.protocol}//${targetDomain}/`;
                        
                        iframe.onload = function() {
                            try {
                                // 通过postMessage发送数据
                                iframe.contentWindow.postMessage({
                                    type: 'HGJ_ACCOUNT_SYNC',
                                    data: data,
                                    timestamp: Date.now()
                                }, `${window.location.protocol}//${targetDomain}`);
                                
                                debugLog(`已向 ${targetDomain} 发送同步数据`);
                                
                                // 1秒后移除iframe
                                setTimeout(() => {
                                    document.body.removeChild(iframe);
                                }, 1000);
                            } catch (e) {
                                debugWarn(`与 ${targetDomain} 同步失败:`, e.message);
                                document.body.removeChild(iframe);
                            }
                        };
                        
                        iframe.onerror = function() {
                            debugWarn(`无法连接到 ${targetDomain}`);
                            document.body.removeChild(iframe);
                        };
                        
                        document.body.appendChild(iframe);
                    } catch (e) {
                        debugWarn(`创建同步iframe失败 (${targetDomain}):`, e.message);
                    }
                }
            });
        }
        
        // 监听来自其他环境的数据同步消息
        window.addEventListener('message', async function(event) {
            // 验证消息来源
            const baseDomain = getBaseDomain();
            const allowedOrigins = [
                `${window.location.protocol}//${baseDomain}`,
                `${window.location.protocol}//dev-${baseDomain}`,
                `${window.location.protocol}//beta-${baseDomain}`
            ];
            
            if (!allowedOrigins.includes(event.origin)) {
                return;
            }
            
            if (event.data && event.data.type === 'HGJ_ACCOUNT_SYNC') {
                debugLog('接收到跨环境同步数据:', event.data);
                
                try {
                    // 检查时间戳，避免循环同步
                    const lastSyncTime = await DataStorage.get(CROSS_ENV_SYNC_KEY);
                    if (!lastSyncTime || event.data.timestamp > parseInt(lastSyncTime)) {
                        await DataStorage.set(STORAGE_KEY, JSON.stringify(event.data.data));
                        await DataStorage.set(CROSS_ENV_SYNC_KEY, event.data.timestamp.toString());
                        debugLog('跨环境数据同步成功');
                        
                        // 刷新当前页面的数据
                        if (window.hgjEnvSwitcher && window.hgjEnvSwitcher.refreshData) {
                            await window.hgjEnvSwitcher.refreshData();
                        }
                    } else {
                        debugLog('跳过旧的同步数据');
                    }
                } catch (e) {
                    debugError('处理跨环境同步数据失败:', e);
                }
            }
        });
        
        // 清除URL中的同步参数
        function cleanUrlParameters(extraParams) {
            const url = new URL(window.location);
            let hasChanges = false;

            // 默认需要清除的参数列表
            const defaultParams = ['hgj_account_sync', 'hgj_switcher_pos', 'hgj_data_sync', 'hgj_one_fill', 'hgj_one_ts', 'hgj_one_token'];
            const paramsToClean = Array.isArray(extraParams) ? defaultParams.concat(extraParams) : defaultParams;

            paramsToClean.forEach(param => {
                if (url.searchParams.has(param)) {
                    url.searchParams.delete(param);
                    hasChanges = true;
                    debugLog(`已清除URL参数: ${param}`);
                }
            });

            // 如果有变化，更新URL但不刷新页面
            if (hasChanges) {
                const cleanUrl = url.toString();
                window.history.replaceState({}, '', cleanUrl);
                debugLog('URL已清理，新URL:', cleanUrl);
            }
        }
        
        // 初始化账号管理器
        async function initAccountManager() {
            // 从DataStorage获取账号数据
            let accountData = await DataStorage.get(STORAGE_KEY);
            let hasReceivedSyncData = false; // 标记是否从URL接收到同步数据
            
            // 如果没有数据，尝试从其他可能的存储位置获取
            if (!accountData) {
                // 尝试从旧的存储键获取数据（兼容性处理）
                const oldData = await DataStorage.get('hgj_account_manager');
                if (oldData) {
                    // 迁移旧数据到新键名
                    await DataStorage.set(STORAGE_KEY, oldData);
                    await DataStorage.delete('hgj_account_manager'); // 清理旧数据
                    accountData = oldData;
                    debugLog('已迁移旧版本账号数据');
                } else {
                    // 尝试从URL参数获取同步数据
                    const urlParams = new URLSearchParams(window.location.search);
                    const syncData = urlParams.get('hgj_account_sync');
                    if (syncData) {
                        try {
                            accountData = decodeURIComponent(syncData);
                            await DataStorage.set(STORAGE_KEY, accountData);
                            hasReceivedSyncData = true;
                            debugLog('从URL参数恢复账号数据');
                        } catch (e) {
                            debugError('URL参数数据解析失败:', e);
                        }
                    }
                }
            }
            
            // 检查是否需要清理URL参数
            const urlParams = new URLSearchParams(window.location.search);
            const hasAnyParam = urlParams.has('hgj_account_sync') || 
                               urlParams.has('hgj_switcher_pos') || 
                               urlParams.has('hgj_data_sync');
            
            if (hasAnyParam) {
                // 延迟清理URL，确保数据处理完成
                setTimeout(() => {
                    cleanUrlParameters();
                }, 1000); // 1秒后清理
            }
            
            // 如果仍然没有数据，初始化一个空的数据结构
            if (!accountData) {
                accountData = {
                    accounts: {},  // 改为对象，使用ID作为键
                    environments: {  // 环境与账号的关联
                        dev: { defaultAccountId: null },
                        beta: { defaultAccountId: null },
                        prod: { defaultAccountId: null }
                    }
                };
                // 保存初始化的数据
                await DataStorage.set(STORAGE_KEY, JSON.stringify(accountData));
                debugLog('初始化空的账号数据结构');
            } else {
                // 解析已有数据
                accountData = JSON.parse(accountData);
                
                // 兼容旧的数组格式，转换为对象格式
                if (Array.isArray(accountData.accounts)) {
                    const newAccounts = {};
                    accountData.accounts.forEach((account, index) => {
                        const id = Date.now() + index; // 生成唯一ID
                        newAccounts[id] = {
                            id: id,
                            name: account.name,
                            username: account.username,
                            password: account.password
                        };
                        
                        // 更新环境关联的索引为ID
                        Object.keys(accountData.environments).forEach(env => {
                            if (accountData.environments[env].defaultAccountId === index) {
                                accountData.environments[env].defaultAccountId = id;
                            }
                        });
                    });
                    accountData.accounts = newAccounts;
                    await DataStorage.set(STORAGE_KEY, JSON.stringify(accountData));
                    debugLog('已转换账号数据格式');
                }
            }
            
            return accountData;
        }

        // 保存账号数据
        async function saveAccountData(data) {
            const timestamp = Date.now();
            
            // 保存到 DataStorage
            await DataStorage.set(STORAGE_KEY, JSON.stringify(data));
            await DataStorage.set(CROSS_ENV_SYNC_KEY, timestamp.toString());
            
            // 同步更新全局变量
            Object.assign(accountData, data);
            
            debugLog('账号数据已保存并同步:', JSON.stringify(data, null, 2));
            
            // 广播更新到其他域名的标签页
            broadcastDataUpdate(data);
            
            // 保持原有的 iframe 同步作为备用方案
            setTimeout(() => {
                syncDataAcrossEnvironments(data);
            }, 100);
        }
        
        // 刷新账号数据
        async function refreshAccountData() {
            const storedData = await DataStorage.get(STORAGE_KEY);
            if (storedData) {
                const parsedData = JSON.parse(storedData);
                
                // 清空并重新赋值，确保引用更新
                for (const key in accountData) {
                    delete accountData[key];
                }
                Object.assign(accountData, parsedData);
                
                debugLog('账号数据已刷新:', JSON.stringify(accountData, null, 2));
            }
        }
        
        // 验证数据完整性
        function validateAccountData() {
            debugLog('验证数据完整性...');
            
            // 检查数据结构
            if (!accountData.accounts || !accountData.environments) {
                debugWarn('数据结构不完整，重新初始化');
                const newData = initAccountManager();
                Object.assign(accountData, newData);
            }
            
            // 检查环境配置
            const requiredEnvs = ['dev', 'beta', 'prod'];
            requiredEnvs.forEach(env => {
                if (!accountData.environments[env]) {
                    debugWarn(`缺少环境配置: ${env}`);
                    accountData.environments[env] = { defaultAccountId: null };
                }
            });
            
            // 检查账号ID的有效性
            Object.keys(accountData.environments).forEach(env => {
                const defaultId = accountData.environments[env].defaultAccountId;
                if (defaultId && !accountData.accounts[defaultId]) {
                    debugWarn(`环境 ${env} 的默认账号ID无效: ${defaultId}`);
                    accountData.environments[env].defaultAccountId = null;
                }
            });
            
            debugLog('数据验证完成');
            return accountData;
        }

        // 异步初始化函数
        async function initializeData() {
            // 初始化账号数据
            const accountData = await initAccountManager();
            
            // 验证数据完整性
            validateAccountData();
            
            // 初始化 BroadcastChannel
            initBroadcastChannel();
            
            // 添加GM_值变化监听器
            DataStorage.addListener(STORAGE_KEY, async (name, oldValue, newValue, remote) => {
                if (remote && newValue !== oldValue) {
                    debugLog('检测到远程数据变化，同步本地数据');
                    try {
                        const newData = JSON.parse(newValue);
                        // 清空并重新赋值，确保引用更新
                        for (const key in accountData) {
                            delete accountData[key];
                        }
                        Object.assign(accountData, newData);
                        
                        // 刷新界面
                        setTimeout(() => {
                            refreshUIComponents();
                        }, 50);
                        
                        debugLog('远程数据同步完成');
                    } catch (error) {
                        debugError('远程数据同步失败:', error);
                    }
                }
            });
            
            // 监听页面可见性变化
            document.addEventListener('visibilitychange', handleVisibilityChange);
            
            // 监听页面焦点变化（额外的保险措施）
            window.addEventListener('focus', () => {
                debugLog('页面获得焦点');
                setTimeout(async () => {
                    await checkAndSyncData();
                }, 50);
            });
            
            // 定期检查数据同步（可选，作为最后的保险措施）
            const syncCheckInterval = setInterval(async () => {
                if (!document.hidden) {
                    await checkAndSyncData();
                }
            }, 5000); // 每5秒检查一次

            // 调试信息：输出当前存储的数据
            debugLog('=== HGJ环境切换器数据状态 ===');
            debugLog('当前环境:', window.location.hostname);
            debugLog('当前存储的账号数据:', JSON.stringify(accountData, null, 2));
            debugLog('存储键名:', STORAGE_KEY);
            debugLog('GM存储中的数据:', await DataStorage.get(STORAGE_KEY));
            debugLog('账号数量:', Object.keys(accountData.accounts).length);
            debugLog('环境配置:', accountData.environments);
            
            // 检查URL参数
            const currentUrlParams = new URLSearchParams(window.location.search);
            if (currentUrlParams.has('hgj_account_sync') || currentUrlParams.has('hgj_switcher_pos') || currentUrlParams.has('hgj_data_sync')) {
                debugLog('=== 检测到同步参数 ===');
                debugLog('账号同步参数:', currentUrlParams.get('hgj_account_sync') ? '存在' : '无');
                debugLog('位置同步参数:', currentUrlParams.get('hgj_switcher_pos') ? '存在' : '无');
                debugLog('数据同步标识:', currentUrlParams.get('hgj_data_sync') ? '存在' : '无');
                debugLog('URL参数将在1秒后清理');
            }
            // 处理一次性填充参数（支持新的 hgj_one_token 以及兼容旧的 hgj_one_fill）
            // 抽取一次性填充尝试逻辑为可复用函数
            async function attemptFillOnce(account) {
                const MAX_TRIES = 10;
                const INTERVAL = 300; // ms

                function manualFill(acc) {
                    try {
                        const allTextInputs = Array.from(document.querySelectorAll('input[type="text"], input[type="email"], input:not([type])'));
                        const usernameInputs = allTextInputs.filter(input => {
                            if (input.disabled || input.readOnly) return false;
                            if (input.offsetWidth < 60) return false;
                            const name = (input.name || '').toLowerCase();
                            const id = (input.id || '').toLowerCase();
                            const placeholder = (input.placeholder || '').toLowerCase();
                            return name.includes('user') || name.includes('email') || id.includes('user') || id.includes('email') || placeholder.includes('user') || placeholder.includes('email') || placeholder.includes('账号') || placeholder.includes('用户名');
                        });

                        const pwdInputs = Array.from(document.querySelectorAll('input[type="password"]')).filter(i => !i.disabled && !i.readOnly);

                        const usernameInput = usernameInputs.length ? usernameInputs[0] : allTextInputs.find(i => !i.disabled && !i.readOnly) || null;
                        const passwordInput = pwdInputs.length ? pwdInputs[0] : null;

                        if (usernameInput) usernameInput.value = acc.username || '';
                        if (passwordInput) passwordInput.value = acc.password || '';

                        const ev = new Event('input', { bubbles: true });
                        if (usernameInput) usernameInput.dispatchEvent(ev);
                        if (passwordInput) passwordInput.dispatchEvent(ev);

                        return !!(usernameInput || passwordInput);
                    } catch (e) {
                        debugError('手动填充失败:', e);
                        return false;
                    }
                }

                for (let i = 0; i < MAX_TRIES; i++) {
                    if (typeof window.hgjEnvSwitcher !== 'undefined' && window.hgjEnvSwitcher.isLoginPage && window.hgjEnvSwitcher.isLoginPage()) {
                        try {
                            if (window.hgjEnvSwitcher && typeof window.hgjEnvSwitcher.fillCredentials === 'function') {
                                window.hgjEnvSwitcher.fillCredentials(account);
                            }
                        } catch (err) {
                            debugWarn('调用 fillCredentials 出错，尝试手动填充:', err);
                        }

                        const usernameFound = Array.from(document.querySelectorAll('input')).some(inp => (inp.value || '') === (account.username || ''));
                        const passwordFound = Array.from(document.querySelectorAll('input[type="password"]')).some(inp => (inp.value || '') === (account.password || ''));

                        if (usernameFound || passwordFound) {
                            debugLog('一次性填充已成功 (fillCredentials 或页面自动检测)，进行稳定性验证...');
                            const STABILITY_DELAY = 400; // ms
                            await new Promise(r => setTimeout(r, STABILITY_DELAY));
                            const usernameStill = Array.from(document.querySelectorAll('input')).some(inp => (inp.value || '') === (account.username || ''));
                            const passwordStill = Array.from(document.querySelectorAll('input[type="password"]')).some(inp => (inp.value || '') === (account.password || ''));
                            if (usernameStill || passwordStill) {
                                try { autoFillEnabled = false; autoFillCount = MAX_AUTO_FILL_COUNT; debugLog('已禁用自动填充以保留一次性填充结果'); } catch (e) { debugWarn('尝试禁用自动填充失败:', e); }
                                return true;
                            } else {
                                debugWarn('一次性填充被页面覆盖，继续重试');
                            }
                        }

                        const manualOk = manualFill(account);
                        if (manualOk) {
                            debugLog('一次性填充已成功 (手动回退)，进行稳定性验证...');
                            const STABILITY_DELAY_MANUAL = 400; // ms
                            await new Promise(r => setTimeout(r, STABILITY_DELAY_MANUAL));
                            const usernameStill2 = Array.from(document.querySelectorAll('input')).some(inp => (inp.value || '') === (account.username || ''));
                            const passwordStill2 = Array.from(document.querySelectorAll('input[type="password"]')).some(inp => (inp.value || '') === (account.password || ''));
                            if (usernameStill2 || passwordStill2) {
                                try { autoFillEnabled = false; autoFillCount = MAX_AUTO_FILL_COUNT; debugLog('已禁用自动填充以保留一次性填充结果 (手动回退)'); } catch (e) { debugWarn('尝试禁用自动填充失败:', e); }
                                return true;
                            } else {
                                debugWarn('一次性手动填充被页面覆盖，继续重试');
                            }
                        }
                    } else {
                        debugLog('尚未到登录页，等待...');
                    }
                    await new Promise(r => setTimeout(r, INTERVAL));
                }

                debugWarn('一次性填充尝试超时或失败');
                return false;
            }

            // 支持新的 token 传递方案：hgj_one_token
            if (currentUrlParams.has('hgj_one_token')) {
                const tokenKey = currentUrlParams.get('hgj_one_token');
                debugLog('检测到一次性填充 token hgj_one_token:', tokenKey);
                try {
                    // 先禁用自动填充以更高概率保留结果
                    try { autoFillEnabled = false; autoFillCount = MAX_AUTO_FILL_COUNT; } catch (e) { debugWarn('禁用自动填充失败:', e); }

                    // 从 DataStorage 中读取临时凭据
                    const raw = await DataStorage.get(tokenKey);
                    if (!raw) {
                        debugWarn('未能从GM存储中读取到一次性凭据 token:', tokenKey);
                    } else {
                        const one = JSON.parse(raw);
                        debugLog('从GM存储读取到一次性凭据:', one);

                        (async () => {
                            if (document.readyState === 'loading') {
                                await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
                            }
                            const ok = await attemptFillOnce(one);
                            // 尝试删除token以避免泄露
                            try { await DataStorage.delete(tokenKey); debugLog('已删除一次性凭据 token:', tokenKey); } catch (e) { debugWarn('删除一次性凭据 token 失败:', e); }
                            if (!ok) debugWarn('一次性填充未成功（token 方案）');
                        })();
                    }
                } catch (err) {
                    debugError('处理 hgj_one_token 失败:', err);
                }
            }

            // 兼容旧的 hgj_one_fill 方案（URL 中直接携带凭据）
            else if (currentUrlParams.has('hgj_one_fill')) {
                debugLog('检测到一次性填充参数 hgj_one_fill (兼容模式)');
                try {
                    const raw = currentUrlParams.get('hgj_one_fill');
                    const decoded = decodeURIComponent(raw);
                    const one = JSON.parse(decoded);
                    debugLog('一次性填充数据解析(兼容模式):', one);
                    try { autoFillEnabled = false; autoFillCount = MAX_AUTO_FILL_COUNT; } catch (e) { debugWarn('尝试在一次性填充前禁用自动填充失败:', e); }

                    (async () => {
                        if (document.readyState === 'loading') {
                            await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
                        }
                        const ok = await attemptFillOnce(one);
                        if (!ok) debugWarn('一次性填充未成功 (兼容模式)');
                    })();
                } catch (err) {
                    debugError('解析 hgj_one_fill 参数失败:', err);
                }
            }
            debugLog('================================');

            return accountData;
        }
        
        // 启动异步初始化 — 预先初始化为默认结构，避免在异步加载前访问时报错
        let accountData = {
            accounts: {},
            environments: {
                dev: { defaultAccountId: null },
                beta: { defaultAccountId: null },
                prod: { defaultAccountId: null }
            }
        };

        initializeData().then((data) => {
            // 合并而不是直接替换引用，确保其他代码持有的引用仍然有效
            for (const k in accountData) delete accountData[k];
            Object.assign(accountData, data);
            
            // 初始化完成后的操作
            debugLog('HGJ环境切换器异步初始化完成');
            
            // 如果需要，在这里执行其他依赖accountData的初始化操作
            setupUrlMonitoring();
    }).catch((error) => {
            debugError('HGJ环境切换器初始化失败:', error);
        });
        
        // 监听URL变化并自动填充账号密码等其他功能
        function setupUrlMonitoring() {

        // 渲染账号列表
        function renderAccountList() {
            debugLog('开始渲染账号列表...');
            const accountList = document.getElementById('account-list');
            if (!accountList) {
                debugError('account-list 元素未找到');
                return;
            }
            
            // 刷新数据确保最新
            refreshAccountData();
            
            accountList.innerHTML = '';
            
            const accountsArray = Object.values(accountData.accounts);
            debugLog('当前账号数组:', accountsArray);
            debugLog('账号数量:', accountsArray.length);
            
            if (accountsArray.length === 0) {
                accountList.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">暂无保存的账号</div>';
                accountList.style.border = 'none';
                accountList.style.padding = '0';
                debugLog('显示暂无账号提示');
                return;
            }
            
            // 如果有账号，恢复正常样式
            accountList.style.border = '';
            accountList.style.padding = '';
            
            accountsArray.forEach((account) => {
                debugLog('渲染账号:', account);
                const accountItem = document.createElement('div');
                accountItem.className = 'account-item';
                // 环境中文名映射
                const envMap = { dev: '开发', beta: '测试', prod: '生产' };
                const envLabel = envMap[account.env || 'prod'] || (account.env || 'prod');
                accountItem.innerHTML = `
                    <div class="account-info">
                        <div class="account-name">${account.name}<span class="account-env-tag">${envLabel}</span></div>
                        <div class="account-username">${account.username}</div>
                    </div>
                    <div class="account-actions">
                        <div class="account-action edit" data-id="${account.id}">编辑</div>
                        <div class="account-action delete" data-id="${account.id}">删除</div>
                    </div>
                `;
                accountList.appendChild(accountItem);
                
                // 添加编辑事件
                accountItem.querySelector('.edit').addEventListener('click', function() {
                    const id = parseInt(this.getAttribute('data-id'));
                    editAccount(id);
                });
                
                // 添加删除事件
                accountItem.querySelector('.delete').addEventListener('click', function() {
                    const id = parseInt(this.getAttribute('data-id'));
                    deleteAccount(id);
                });
            });
            
            debugLog('账号列表渲染完成');
        }

        // 编辑账号
        function editAccount(id) {
            const account = accountData.accounts[id];
            if (!account) return;
            
            const nameInput = document.getElementById('account-name');
            const usernameInput = document.getElementById('account-username');
            const passwordInput = document.getElementById('account-password');
            const saveButton = document.getElementById('save-account');
            
            if (!nameInput || !usernameInput || !passwordInput || !saveButton) {
                debugError('编辑账号时，表单元素未找到');
                return;
            }
            
            nameInput.value = account.name;
            usernameInput.value = account.username;
            passwordInput.value = account.password;
            
            // 更改保存按钮行为
            saveButton.textContent = '更新账号';
            saveButton.setAttribute('data-edit-id', id);
            
            // 滚动到表单位置
            const accountForm = document.querySelector('.account-form');
            if (accountForm) {
                accountForm.scrollIntoView({ behavior: 'smooth' });
            }
        }

        // 删除账号
        function deleteAccount(id) {
            if (confirm('确定要删除这个账号吗？')) {
                delete accountData.accounts[id];
                
                // 检查并更新环境关联
                for (const env in accountData.environments) {
                    if (accountData.environments[env].defaultAccountId === id) {
                        accountData.environments[env].defaultAccountId = null;
                    }
                }
                
                saveAccountData(accountData);
                renderAccountList();
                renderEnvironmentSettings();
            }
        }

        // 渲染环境设置
        function renderEnvironmentSettings() {
            debugLog('开始渲染环境设置...');
            const envSettings = document.getElementById('env-settings');
            if (!envSettings) {
                debugError('env-settings 元素未找到');
                return;
            }
            
            // 刷新数据确保最新
            refreshAccountData();
            
            envSettings.innerHTML = '';
            
            const environments = [
                { key: 'dev', name: '开发环境' },
                { key: 'beta', name: '测试环境' },
                { key: 'prod', name: '生产环境' }
            ];
            
            environments.forEach(env => {
                debugLog(`渲染环境: ${env.name} (${env.key})`);
                const envSetting = document.createElement('div');
                envSetting.className = 'env-setting';
                
                const accountsArray = Object.values(accountData.accounts);
                debugLog(`${env.name}可用账号:`, accountsArray);
                
                const selectOptions = accountsArray.map((account) => {
                    const selected = accountData.environments[env.key].defaultAccountId === account.id ? 'selected' : '';
                    debugLog(`账号 ${account.name} (ID:${account.id}) 是否选中:`, selected);
                    return `<option value="${account.id}" ${selected}>${account.name} (${account.username})</option>`;
                }).join('');
                
                envSetting.innerHTML = `
                    <div class="env-name">${env.name}</div>
                    <select class="env-account-select" data-env="${env.key}">
                        <option value="">-- 选择默认账号 --</option>
                        ${selectOptions}
                    </select>
                `;
                
                envSettings.appendChild(envSetting);
                
                // 添加选择事件
                const select = envSetting.querySelector('select');
                select.addEventListener('change', function() {
                    const envKey = this.getAttribute('data-env');
                    const accountId = this.value === '' ? null : parseInt(this.value);
                    debugLog(`设置环境 ${envKey} 默认账号为:`, accountId);
                    accountData.environments[envKey].defaultAccountId = accountId;
                    saveAccountData(accountData);
                });
            });
            
            debugLog('环境设置渲染完成');
        }

        // 监听URL变化并自动填充账号密码
        function setupUrlMonitoring() {
            // 获取当前环境
            function getCurrentEnvironment() {
                const hostname = window.location.hostname;
                if (hostname.includes('dev') || hostname.includes('localhost')) {
                    return 'dev';
                } else if (hostname.includes('beta') || hostname.includes('test')) {
                    return 'beta';
                } else {
                    return 'prod';
                }
            }
            
            // 检查是否是登录页面
            function isLoginPage() {
                return window.location.pathname.includes('login');
            }
            
            // 手动填充账号密码 — 仅负责填写表单，不再修改会话选择（会话管理应由调用方显式完成）
            // 兼容旧的调用签名：第二个参数仍然被接受但已忽略
            function fillCredentials(account, options = {}) {
                debugLog(`正在填充账号: ${account.name}`);
                
                // 查找用户名输入框 - 排除区号选择框和短输入框
                const allTextInputs = Array.from(document.querySelectorAll('input[type="text"], input[type="email"], input:not([type])'));
                const usernameInputs = allTextInputs.filter(input => {
                    // 排除区号相关的输入框
                    if (input.value === '+86' || input.value === '86' || input.placeholder === '+86') {
                        return false;
                    }
                    // 排除太短的输入框（通常是区号框）
                    if (input.offsetWidth < 100) {
                        return false;
                    }
                    // 排除disabled或readonly的输入框
                    if (input.disabled || input.readOnly) {
                        return false;
                    }
                    // 优先选择有用户名相关属性的输入框
                    const name = (input.name || '').toLowerCase();
                    const id = (input.id || '').toLowerCase();
                    const placeholder = (input.placeholder || '').toLowerCase();
                    const className = (input.className || '').toLowerCase();
                    
                    // 排除明确是区号的输入框
                    if (name.includes('code') || id.includes('code') || 
                        placeholder.includes('区号') || className.includes('code')) {
                        return false;
                    }
                    
                    return true;
                });
                
                const passwordInputs = Array.from(document.querySelectorAll('input[type="password"]'));
                
                // 尝试填充用户名
                if (usernameInputs.length > 0) {
                    // 优先选择包含用户名相关关键词的输入框
                    let usernameInput = usernameInputs.find(input => {
                        const name = (input.name || '').toLowerCase();
                        const id = (input.id || '').toLowerCase();
                        const placeholder = (input.placeholder || '').toLowerCase();
                        
                        return name.includes('username') || name.includes('user') || name.includes('account') ||
                               id.includes('username') || id.includes('user') || id.includes('account') ||
                               placeholder.includes('用户名') || placeholder.includes('账号') || 
                               placeholder.includes('手机号') || placeholder.includes('邮箱');
                    });
                    
                    // 如果没找到特定的，使用第一个
                    if (!usernameInput) {
                        usernameInput = usernameInputs[0];
                    }
                    
                    usernameInput.value = account.username;
                    // 触发input事件，以便可能的表单验证能够识别到值的变化
                    usernameInput.dispatchEvent(new Event('input', { bubbles: true }));
                    usernameInput.dispatchEvent(new Event('change', { bubbles: true }));
                    debugLog('已填充用户名到:', usernameInput.name || usernameInput.id || usernameInput.placeholder);
                } else {
                    debugLog('未找到合适的用户名输入框');
                }
                
                // 尝试填充密码
                if (passwordInputs.length > 0) {
                    const passwordInput = passwordInputs[0];
                    passwordInput.value = account.password;
                    // 触发input事件
                    passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
                    passwordInput.dispatchEvent(new Event('change', { bubbles: true }));
                    debugLog('已填充密码');
                } else {
                    debugLog('未找到密码输入框');
                }
                
                // 填充成功后不自动修改会话，调用方应在需要时显式调用 setSessionCurrentAccountId(account.id)
                debugLog(`账号填充完成（仅填写表单）: ${account.name} (ID: ${account.id})`);
                
                // 填充完成后，根据域名自动点击登录按钮
                triggerLoginButton();
            }
            
            // 根据不同域名触发登录按钮点击
            function triggerLoginButton() {
                const hostname = window.location.hostname;
                debugLog('准备触发登录按钮，当前域名:', hostname);
                
                // 延迟触发，确保填充完成后再点击
                setTimeout(() => {
                    if (hostname.includes('eyun.hgj.com')) {
                        clickEyunLoginButton();
                    } else if (hostname.includes('smartai.hgj.com')) {
                        clickSmartaiLoginButton();
                    } else if (hostname.includes('login.hgj.com')) {
                        clickLoginHgjLoginButton();
                    } else {
                        debugLog('未匹配到已配置的域名，跳过自动点击登录按钮');
                    }
                }, 500); // 延迟500ms确保填充完成
            }
            
            // eyun.hgj.com 登录按钮点击
            function clickEyunLoginButton() {
                debugLog('开始处理 eyun.hgj.com 登录按钮点击...');
                
                try {
                    const articles = document.querySelectorAll('article');
                    debugLog('找到的 article 元素数量:', articles.length);
                    
                    if (articles.length >= 2) {
                        const loginButton = articles[1];
                        debugLog('找到登录按钮元素 (articles[1]):', loginButton);
                        
                        // 检查元素是否可见和可点击
                        if (loginButton.offsetParent !== null) {
                            // 模拟点击事件
                            loginButton.click();
                            debugLog('已点击 eyun.hgj.com 登录按钮');
                            
                            // 也触发其他可能的事件
                            loginButton.dispatchEvent(new Event('mousedown', { bubbles: true }));
                            loginButton.dispatchEvent(new Event('mouseup', { bubbles: true }));
                            loginButton.dispatchEvent(new Event('click', { bubbles: true }));
                            
                        } else {
                            debugWarn('eyun.hgj.com 登录按钮不可见，跳过点击');
                        }
                    } else {
                        debugWarn('eyun.hgj.com 页面未找到足够的 article 元素 (需要至少2个)');
                    }
                } catch (error) {
                    debugError('eyun.hgj.com 登录按钮点击失败:', error);
                }
            }
            
            // smartai.hgj.com 登录按钮点击 (待实现)
            function clickSmartaiLoginButton() {
                debugLog('smartai.hgj.com 登录按钮点击规则待实现');
                // TODO: 根据 smartai.hgj.com 页面结构实现登录按钮点击
            }
            
            // login.hgj.com 登录按钮点击
            function clickLoginHgjLoginButton() {
                debugLog('开始处理 login.hgj.com 登录按钮点击...');
                
                try {
                    const loginButtons = document.querySelectorAll('.login-btn');
                    debugLog('找到的 .login-btn 元素数量:', loginButtons.length);
                    
                    if (loginButtons.length >= 1) {
                        const loginButton = loginButtons[0];
                        debugLog('找到登录按钮元素 (.login-btn[0]):', loginButton);
                        
                        // 检查元素是否可见和可点击
                        if (loginButton.offsetParent !== null) {
                            // 模拟点击事件
                            loginButton.click();
                            debugLog('已点击 login.hgj.com 登录按钮');
                            
                            // 也触发其他可能的事件
                            loginButton.dispatchEvent(new Event('mousedown', { bubbles: true }));
                            loginButton.dispatchEvent(new Event('mouseup', { bubbles: true }));
                            loginButton.dispatchEvent(new Event('click', { bubbles: true }));
                            
                        } else {
                            debugWarn('login.hgj.com 登录按钮不可见，跳过点击');
                        }
                    } else {
                        debugWarn('login.hgj.com 页面未找到 .login-btn 元素');
                    }
                } catch (error) {
                    debugError('login.hgj.com 登录按钮点击失败:', error);
                }
            }
            
            // 自动填充账号密码
            // 自动填充账号密码
            function autoFillCredentials() {
                debugLog('尝试自动填充账号密码...');
                if (!isLoginPage()) return;
                
                // 检查自动填充是否被禁用
                if (!autoFillEnabled) {
                    debugLog('自动填充已被禁用，跳过填充');
                    return;
                }
                
                // 检查是否已达到最大填充次数
                if (autoFillCount >= MAX_AUTO_FILL_COUNT) {
                    debugLog(`自动填充次数已达上限 (${autoFillCount}/${MAX_AUTO_FILL_COUNT})，跳过填充`);
                    return;
                }
                
                // 等待页面渲染完成
                setTimeout(() => {
                    const currentEnv = getCurrentEnvironment();
                    
                    // 优先使用会话中的当前账号，如果没有则使用默认账号
                    const targetAccountId = sessionCurrentAccountId || accountData.environments[currentEnv].defaultAccountId;
                    
                    if (targetAccountId === null) {
                        if (sessionCurrentAccountId !== null) {
                            debugLog('会话中的账号不存在，且未设置默认账号');
                        } else {
                            debugLog(`当前环境(${currentEnv})未设置默认账号`);
                        }
                        return;
                    }
                    
                    const account = accountData.accounts[targetAccountId];
                    if (!account) {
                        if (sessionCurrentAccountId !== null) {
                            debugLog('会话中的账号已被删除，尝试使用默认账号');
                            // 清除无效的会话账号ID，回退到默认账号
                            setSessionCurrentAccountId(null);
                            const fallbackAccountId = accountData.environments[currentEnv].defaultAccountId;
                            if (fallbackAccountId && accountData.accounts[fallbackAccountId]) {
                                const fallbackAccount = accountData.accounts[fallbackAccountId];
                                debugLog(`回退填充默认账号: ${fallbackAccount.name}`);
                                fillCredentials(fallbackAccount);
                                // 自动填充视为会话选择时也应显式设置会话
                                try {
                                    setSessionCurrentAccountId(fallbackAccount.id);
                                    debugLog('自动填充（回退）已设置会话当前账号:', fallbackAccount.id);
                                } catch (e) {
                                    debugWarn('设置会话当前账号失败:', e);
                                }
                                autoFillCount++;
                            }
                        } else {
                            debugLog('未找到默认账号');
                        }
                        return;
                    }
                    
                    const isSessionAccount = sessionCurrentAccountId !== null;
                    debugLog(`正在为${currentEnv}环境自动填充账号: ${account.name} (${isSessionAccount ? '会话选择' : '默认账号'}, 第${autoFillCount + 1}次)`);
                    fillCredentials(account);
                    // 如果自动填充来源于会话选择或我们希望自动填充也记录为会话选择，显式设置会话
                    try {
                        if (isSessionAccount) {
                            setSessionCurrentAccountId(account.id);
                            debugLog('自动填充（会话优先）已设置会话当前账号:', account.id);
                        }
                    } catch (e) {
                        debugWarn('自动填充后设置会话失败:', e);
                    }
                    // 增加填充次数计数
                    autoFillCount++;
                    debugLog(`自动填充完成，当前次数: ${autoFillCount}/${MAX_AUTO_FILL_COUNT}`);
                }, 1000); // 延迟1秒，等待页面渲染
            }
            
            // 暴露函数给外部使用
            window.hgjEnvSwitcher = {
                getCurrentEnvironment,
                isLoginPage,
                fillCredentials,
                // 添加调试函数
                getStoredData: async () => await DataStorage.get(STORAGE_KEY),
                getAccountData: () => accountData,
                refreshData: refreshAccountData,
                // 添加测试数据函数
                addTestAccount: () => {
                    const testId = Date.now();
                    const testAccount = {
                        id: testId,
                        name: '测试账号',
                        username: 'test@example.com',
                        password: 'test123'
                    };
                    accountData.accounts[testId] = testAccount;
                    saveAccountData(accountData);
                    debugLog('已添加测试账号:', testAccount);
                    return testAccount;
                },
                // 清空所有数据
                clearAllData: async () => {
                    await DataStorage.delete(STORAGE_KEY);
                    debugLog('已清空所有数据');
                },
                // 强制同步数据
                forceSync: () => {
                    refreshAccountData();
                    validateAccountData();
                    debugLog('已强制同步数据');
                    return accountData;
                },
                // 检查跨页面同步状态
                checkSyncStatus: async () => {
                    const stored = await DataStorage.get(STORAGE_KEY);
                    const current = JSON.stringify(accountData);
                    const synced = stored === current;
                    debugLog('同步状态:', synced ? '已同步' : '未同步');
                    debugLog('存储数据:', stored);
                    debugLog('内存数据:', current);
                    return synced;
                },
                // 手动触发跨环境同步
                manualSync: () => {
                    debugLog('手动触发跨环境同步...');
                    syncDataAcrossEnvironments(accountData);
                },
                // 获取当前环境信息
                getEnvironmentInfo: async () => {
                    const info = {
                        hostname: window.location.hostname,
                        baseDomain: getBaseDomain(),
                        currentEnv: window.hgjEnvSwitcher.getCurrentEnvironment(),
                        accountCount: Object.keys(accountData.accounts).length,
                        lastSyncTime: await DataStorage.get(CROSS_ENV_SYNC_KEY),
                        hasUrlParams: new URLSearchParams(window.location.search).has('hgj_account_sync') ||
                                     new URLSearchParams(window.location.search).has('hgj_switcher_pos') ||
                                     new URLSearchParams(window.location.search).has('hgj_data_sync')
                    };
                    debugLog('环境信息:', info);
                    return info;
                },
                // 手动清理URL参数
                cleanUrl: () => {
                    debugLog('手动清理URL参数...');
                    cleanUrlParameters();
                },
                // 检查URL参数状态
                checkUrlParams: () => {
                    const urlParams = new URLSearchParams(window.location.search);
                    const params = {
                        account_sync: urlParams.get('hgj_account_sync'),
                        switcher_pos: urlParams.get('hgj_switcher_pos'),
                        data_sync: urlParams.get('hgj_data_sync')
                    };
                    debugLog('当前URL参数:', params);
                    debugLog('完整URL:', window.location.href);
                    return params;
                },
                // 检查账号管理弹窗状态
                checkModalStatus: () => {
                    const modal = document.querySelector('.account-modal');
                    const accountList = document.getElementById('account-list');
                    const activeTab = document.querySelector('.account-tab.active');
                    const activeContent = document.querySelector('.account-tab-content.active');
                    
                    const status = {
                        modalExists: !!modal,
                        modalVisible: modal ? modal.classList.contains('show') : false,
                        accountListExists: !!accountList,
                        activeTabText: activeTab ? activeTab.textContent : null,
                        activeContentId: activeContent ? activeContent.id : null,
                        accountListHTML: accountList ? accountList.innerHTML : null
                    };
                    
                    debugLog('账号管理弹窗状态:', status);
                    return status;
                },
                // 检查当前账号状态
                checkCurrentAccount: () => {
                    const currentEnv = window.hgjEnvSwitcher.getCurrentEnvironment();
                    const defaultAccountId = accountData.environments[currentEnv].defaultAccountId;
                    const defaultAccount = accountData.accounts[defaultAccountId];
                    const sessionAccount = accountData.accounts[sessionCurrentAccountId];
                    
                    const status = {
                        currentEnv,
                        sessionCurrentAccountId,
                        sessionAccount: sessionAccount ? {
                            id: sessionAccount.id,
                            name: sessionAccount.name,
                            username: sessionAccount.username
                        } : null,
                        defaultAccountId,
                        defaultAccount: defaultAccount ? {
                            id: defaultAccount.id,
                            name: defaultAccount.name,
                            username: defaultAccount.username
                        } : null,
                        usingSessionAccount: sessionCurrentAccountId !== null
                    };
                    
                    debugLog('当前账号状态:', status);
                    return status;
                },
                // 清除会话当前账号（恢复使用默认账号）
                clearSessionAccount: () => {
                    setSessionCurrentAccountId(null);
                    debugLog('已清除会话当前账号，将使用默认账号');
                },
                // 手动刷新快速账号菜单
                refreshQuickMenu: () => {
                    const accountManagerBtn = document.querySelector('.account-manager-btn');
                    if (accountManagerBtn) {
                        const oldMenu = accountManagerBtn.querySelector('.quick-account-menu');
                        if (oldMenu) {
                            oldMenu.remove();
                        }
                        createQuickAccountMenu().then(newMenu => {
                            accountManagerBtn.appendChild(newMenu);
                            newMenu.style.display = 'flex';
                            debugLog('快速菜单已手动刷新');
                        });
                    } else {
                        debugLog('未找到账号管理按钮');
                    }
                },
                // 检查自动填充状态
                checkAutoFillStatus: () => {
                    const status = {
                        autoFillEnabled,
                        autoFillCount,
                        maxAutoFillCount: MAX_AUTO_FILL_COUNT,
                        canAutoFill: autoFillEnabled && autoFillCount < MAX_AUTO_FILL_COUNT,
                        sessionCurrentAccountId,
                        isLoginPage: isLoginPage(),
                        currentEnv: getCurrentEnvironment()
                    };
                    debugLog('自动填充状态:', status);
                    return status;
                },
                // 启用自动填充
                enableAutoFill: () => {
                    autoFillEnabled = true;
                    debugLog('已启用自动填充');
                },
                // 禁用自动填充
                disableAutoFill: () => {
                    autoFillEnabled = false;
                    debugLog('已禁用自动填充');
                },
                // 重置自动填充状态（清除会话选择，恢复自动填充，重置次数）
                resetAutoFillState: () => {
                    setSessionCurrentAccountId(null);
                    autoFillEnabled = true;
                    autoFillCount = 0;
                    debugLog('已重置自动填充状态（包括填充次数）');
                },
                // 仅重置自动填充次数
                resetAutoFillCount: () => {
                    const oldCount = autoFillCount;
                    autoFillCount = 0;
                    debugLog(`已重置自动填充次数: ${oldCount} -> ${autoFillCount}`);
                },
                // 手动触发填充（忽略自动填充开关）
                manualFill: () => {
                    if (!isLoginPage()) {
                        debugLog('当前不在登录页面');
                        return;
                    }
                    
                    const currentEnv = getCurrentEnvironment();
                    // 优先使用会话中的当前账号，如果没有则使用默认账号
                    const targetAccountId = sessionCurrentAccountId || accountData.environments[currentEnv].defaultAccountId;
                    
                    if (targetAccountId === null) {
                        debugLog('未找到可填充的账号');
                        return;
                    }
                    
                    const account = accountData.accounts[targetAccountId];
                    if (!account) {
                        debugLog('账号不存在');
                        return;
                    }
                    
                    debugLog(`手动填充账号: ${account.name}`);
                    fillCredentials(account);
                    // 手动填充视为用户选择：显式设置会话当前账号并禁用自动填充，避免被自动逻辑覆盖
                    try {
                        setSessionCurrentAccountId(account.id);
                        autoFillEnabled = false;
                        autoFillCount = 0;
                        debugLog('手动填充已设置会话并禁用自动填充');
                    } catch (e) {
                        debugWarn('手动填充后设置会话或禁用自动填充失败:', e);
                    }
                },
                // 清除 hgj 开头的 cookies
                clearHgjCookies: () => {
                    const clearedCount = clearHgjCookies();
                    debugLog(`已清除 ${clearedCount} 个 hgj 相关 cookie`);
                    return clearedCount;
                },
                // 强力清除 hgj 开头的 cookies
                forceClearHgjCookies: () => {
                    const clearedCount1 = clearHgjCookies();
                    const clearedCount2 = forceClearHgjCookies();
                    const total = clearedCount1 + clearedCount2;
                    debugLog(`强力清除完成，总计处理 ${total} 个 hgj 相关 cookie`);
                    return total;
                },
                // 检查当前页面的 cookies
                checkHgjCookies: () => {
                    const cookies = document.cookie.split('; ');
                    const hgjCookies = cookies.filter(cookie => {
                        const name = cookie.split('=')[0];
                        return name.toLowerCase().startsWith('hgj');
                    });
                    debugLog('当前 hgj 相关 cookies:', hgjCookies);
                    return hgjCookies;
                },
                // 调试控制函数
                enableDebug: () => {
                    // 由于DEBUG_ENABLED是const，我们需要通过全局变量来控制
                    window.HGJ_DEBUG_ENABLED = true;
                    debugLog('调试输出已启用');
                },
                disableDebug: () => {
                    window.HGJ_DEBUG_ENABLED = false;
                    console.log('[HGJ环境切换器] 调试输出已禁用');
                },
                getDebugStatus: () => {
                    const status = window.HGJ_DEBUG_ENABLED !== false && DEBUG_ENABLED;
                    console.log('[HGJ环境切换器] 调试输出状态:', status ? '启用' : '禁用');
                    return status;
                },
                // 检查 BroadcastChannel 状态
                checkBroadcastStatus: () => {
                    const status = {
                        supported: 'BroadcastChannel' in window,
                        channelExists: !!broadcastChannel,
                        readyState: broadcastChannel ? 'open' : 'closed'
                    };
                    debugLog('BroadcastChannel 状态:', status);
                    return status;
                },
                
                // 手动触发数据同步检查
                manualSyncCheck: async () => {
                    debugLog('手动触发同步检查...');
                    debugLog('当前GM存储数据:', await DataStorage.get(STORAGE_KEY));
                    debugLog('当前内存accountData:', JSON.stringify(accountData, null, 2));
                    await checkAndSyncData();
                },
                
                // 手动发送测试广播
                testBroadcast: () => {
                    if (broadcastChannel) {
                        const testMessage = {
                            type: 'test_message',
                            timestamp: Date.now(),
                            origin: window.location.hostname,
                            message: 'This is a test broadcast'
                        };
                        broadcastChannel.postMessage(testMessage);
                        debugLog('已发送测试广播:', testMessage);
                    } else {
                        debugLog('BroadcastChannel 不可用');
                    }
                },
                
                // 手动刷新UI组件
                refreshUI: () => {
                    debugLog('手动刷新UI组件...');
                    refreshUIComponents();
                },
                
                // 检查页面可见性状态
                checkVisibility: () => {
                    const status = {
                        hidden: document.hidden,
                        visibilityState: document.visibilityState,
                        hasFocus: document.hasFocus()
                    };
                    debugLog('页面可见性状态:', status);
                    return status;
                },
                
                // 模拟数据变化（用于测试）
                simulateDataChange: () => {
                    debugLog('模拟数据变化...');
                    const testAccount = {
                        id: Date.now(),
                        name: `测试账号_${Date.now()}`,
                        username: `test_${Date.now()}@example.com`,
                        password: 'test123'
                    };
                    accountData.accounts[testAccount.id] = testAccount;
                    saveAccountData(accountData);
                    debugLog('已添加测试账号并触发同步:', testAccount);
                },
                
                // 检查当前数据状态
                checkDataStatus: async () => {
                    const gm_data = await DataStorage.get(STORAGE_KEY);
                    const memory_data = JSON.stringify(accountData);
                    const status = {
                        gm_storage_exists: !!gm_data,
                        memory_exists: !!accountData,
                        data_matches: gm_data === memory_data,
                        gm_storage_length: gm_data ? gm_data.length : 0,
                        memory_length: memory_data ? memory_data.length : 0,
                        account_count_gm_storage: gm_data ? Object.keys(JSON.parse(gm_data).accounts || {}).length : 0,
                        account_count_memory: Object.keys(accountData.accounts || {}).length,
                        gm_timestamp: await DataStorage.get(CROSS_ENV_SYNC_KEY),
                        current_hostname: window.location.hostname
                    };
                    debugLog('数据状态检查:', status);
                    debugLog('localStorage原始数据:', localStorage_data);
                    debugLog('内存原始数据:', memory_data);
                    return status;
                },
                
                // 强制广播当前数据
                forceBroadcast: () => {
                    debugLog('强制广播当前数据...');
                    broadcastDataUpdate(accountData);
                },
                // 手动触发登录按钮点击
                triggerLoginButton: () => {
                    debugLog('手动触发登录按钮点击...');
                    triggerLoginButton();
                },
                // 测试特定域名的登录按钮
                testEyunLoginButton: () => {
                    debugLog('测试 eyun.hgj.com 登录按钮...');
                    clickEyunLoginButton();
                },
                testSmartaiLoginButton: () => {
                    debugLog('测试 smartai.hgj.com 登录按钮...');
                    clickSmartaiLoginButton();
                },
                testLoginHgjLoginButton: () => {
                    debugLog('测试 login.hgj.com 登录按钮...');
                    clickLoginHgjLoginButton();
                },
                // 检查登录按钮元素
                checkLoginButtons: () => {
                    const hostname = window.location.hostname;
                    const result = {
                        hostname,
                        buttons: {}
                    };
                    
                    if (hostname.includes('eyun.hgj.com')) {
                        const articles = document.querySelectorAll('article');
                        result.buttons.eyun = {
                            articleCount: articles.length,
                            targetButton: articles.length >= 2 ? articles[1] : null,
                            buttonVisible: articles.length >= 2 ? articles[1].offsetParent !== null : false
                        };
                    } else if (hostname.includes('login.hgj.com')) {
                        const loginButtons = document.querySelectorAll('.login-btn');
                        result.buttons.loginHgj = {
                            loginBtnCount: loginButtons.length,
                            targetButton: loginButtons.length >= 1 ? loginButtons[0] : null,
                            buttonVisible: loginButtons.length >= 1 ? loginButtons[0].offsetParent !== null : false
                        };
                    }
                    
                    debugLog('登录按钮检查结果:', result);
                    return result;
                }
            };
            
            // 初始检查
            autoFillCredentials();
            
            // 使用MutationObserver监听DOM变化
            const observer = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    if (mutation.type === 'childList' && isLoginPage()) {
                        autoFillCredentials();
                        break;
                    }
                }
            });
            
            // 开始监听整个文档的变化
            observer.observe(document.body, { childList: true, subtree: true });
            
            // 监听URL变化（针对SPA应用）
            let lastUrl = window.location.href;
            const urlObserver = setInterval(() => {
                if (lastUrl !== window.location.href) {
                    lastUrl = window.location.href;
                    autoFillCredentials();
                }
            }, 1000);
        }

        // 启动URL监听
        setupUrlMonitoring();
        
        // 创建样式
        const style = document.createElement('style');
        style.textContent = `
            .env-switcher {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 56px;
                height: 56px;
                border-radius: 50%;
                display: flex;
                justify-content: center;
                align-items: center;
                color: white;
                font-weight: bold;
                cursor: move;
                z-index: 99999;
                transition: all 0.3s ease;
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
            
            .env-switcher:hover {
                transform: scale(1.1);
            }
            
            .env-options {
                position: absolute;
                bottom: 65px;
                right: 0;
                display: none;
                flex-direction: column;
                gap: 12px;
                padding: 5px;
            }
            
            .env-options.show {
                display: flex;
                animation: fadeIn 0.3s ease;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            .env-option {
                width: 110px;
                height: 42px;
                background-color: rgba(255, 255, 255, 0.9);
                border-radius: 21px;
                display: flex;
                justify-content: center;
                align-items: center;
                color: #333;
                font-weight: bold;
                cursor: pointer;
                box-shadow: 0 3px 8px rgba(0, 0, 0, 0.15);
                transition: all 0.2s ease;
                user-select: none;
                backdrop-filter: blur(5px);
                border: 1px solid rgba(255, 255, 255, 0.5);
            }
            
            .env-option:hover {
                background-color: #f1f1f1;
                transform: scale(1.05);
            }
            
            .env-dev {
                background: linear-gradient(135deg, #43a047, #2e7d32);
                color: white;
            }
            
            .env-beta {
                background: linear-gradient(135deg, #fb8c00, #ef6c00);
                color: white;
            }
            
            .env-prod {
                background: linear-gradient(135deg, #e53935, #c62828);
                color: white;
            }
            
            .env-option span {
                display: inline-block;
                margin-left: 5px;
            }
            
            /* 账号管理按钮样式 */
            .account-manager-btn {
                position: absolute;
                top: -10px;
                right: -10px;
                width: 24px;
                height: 24px;
                background-color: #673ab7;
                border-radius: 50%;
                display: flex;
                justify-content: center;
                align-items: center;
                color: white;
                font-size: 14px;
                cursor: pointer;
                box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
                transition: all 0.2s ease;
                z-index: 10001;
            }
            
            .account-manager-btn:hover {
                transform: scale(1.1);
                background-color: #7e57c2;
            }
            
            /* 快速切换账号菜单 */
            .quick-account-menu {
                position: absolute;
                top: -5px;
                right: 30px;
                background-color: rgba(255, 255, 255, 0.95);
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                backdrop-filter: blur(5px);
                border: 1px solid rgba(255, 255, 255, 0.5);
                min-width: 150px;
                max-width: 200px;
                max-height: 200px;
                display: none;
                flex-direction: column;
                z-index: 99999;
                animation: quickMenuFadeIn 0.2s ease;
                overflow: hidden;
            }
            
            .quick-account-menu.show {
                display: flex;
            }
            
            @keyframes quickMenuFadeIn {
                from { opacity: 0; transform: translateX(10px); }
                to { opacity: 1; transform: translateX(0); }
            }
            
            .quick-account-header {
                padding: 8px 12px;
                background-color: rgba(66, 133, 244, 0.1);
                border-bottom: 1px solid rgba(0, 0, 0, 0.1);
                border-radius: 8px 8px 0 0;
                font-size: 12px;
                font-weight: bold;
                color: #4285f4;
                text-align: center;
                flex-shrink: 0;
            }
            
            .quick-account-items {
                flex: 1;
                overflow-y: auto;
                overflow-x: hidden;
            }
            
            .quick-account-items::-webkit-scrollbar {
                width: 4px;
            }
            
            .quick-account-items::-webkit-scrollbar-track {
                background: transparent;
            }
            
            .quick-account-items::-webkit-scrollbar-thumb {
                background: rgba(0, 0, 0, 0.2);
                border-radius: 2px;
            }
            
            .quick-account-items::-webkit-scrollbar-thumb:hover {
                background: rgba(0, 0, 0, 0.3);
            }
            
            .quick-account-item {
                padding: 8px 12px;
                cursor: pointer;
                border-bottom: 1px solid rgba(0, 0, 0, 0.05);
                transition: background-color 0.2s ease;
                font-size: 13px;
            }
            
            .quick-account-item:last-child {
                border-bottom: none;
                border-radius: 0 0 8px 8px;
            }
            
            .quick-account-item:hover {
                background-color: rgba(66, 133, 244, 0.1);
            }
            
            .quick-account-name {
                font-weight: bold;
                color: #333;
                font-size: 12px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .quick-account-username {
                color: #666;
                font-size: 11px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                margin-top: 2px;
            }
            
            .quick-account-current {
                background-color: rgba(52, 168, 83, 0.1);
                border-left: 3px solid #34a853;
            }
            
            .quick-account-current .quick-account-name {
                color: #34a853;
            }
            
            /* 账号管理弹窗样式 */
            .account-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                display: none;
                justify-content: center;
                align-items: center;
                z-index: 99999;
            }
            
            .account-modal.show {
                display: flex;
                animation: fadeIn 0.3s ease;
            }
            
            .account-modal-content {
                width: 90vw;
                max-width: 450px;
                height: 800px;
                background-color: white;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                overflow: hidden;
                display: flex;
                flex-direction: column;
            }
            
            .account-modal-header {
                padding: 15px 20px;
                background-color: #4285f4;
                color: white;
                font-weight: bold;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-shrink: 0;
            }
            
            .account-modal-close {
                cursor: pointer;
                font-size: 20px;
            }
            
            .account-modal-body {
                padding: 20px;
                overflow: hidden;
                flex: 1;
                display: flex;
                flex-direction: column;
            }
            
            .account-tabs {
                display: flex;
                border-bottom: 1px solid #e0e0e0;
                margin-bottom: 15px;
            }
            
            .account-tab {
                padding: 8px 15px;
                cursor: pointer;
                border-bottom: 2px solid transparent;
            }
            
            .account-tab.active {
                border-bottom-color: #4285f4;
                color: #4285f4;
                font-weight: bold;
            }
            
            .account-tab-content {
                display: none;
                flex: 1;
                overflow: hidden;
                flex-direction: column;
            }
            
            .account-tab-content.active {
                display: flex;
            }
            
            .account-form {
                margin-bottom: 20px;
                flex-shrink: 0;
            }
            
            .form-group {
                margin-bottom: 15px;
            }
            
            .form-group label {
                display: block;
                margin-bottom: 5px;
                font-weight: 500;
            }
            
            .form-group input {
                width: calc(100% - 20px);
                padding: 8px 10px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 14px;
                box-sizing: border-box;
            }
            
            .btn {
                padding: 8px 15px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: 500;
                transition: all 0.2s;
            }
            
            .btn-primary {
                background-color: #4285f4;
                color: white;
            }
            
            .btn-primary:hover {
                background-color: #3367d6;
            }
            
            .btn-danger {
                background-color: #ea4335;
                color: white;
            }
            
            .btn-danger:hover {
                background-color: #d33426;
            }
            
            .account-list {
                margin-top: 20px;
                max-height: 300px;
                overflow-y: auto;
                border: 1px solid #e0e0e0;
                border-radius: 4px;
                padding: 10px;
                box-sizing: border-box;
            }
            
            .account-list::-webkit-scrollbar {
                width: 6px;
            }
            
            .account-list::-webkit-scrollbar-track {
                background: #f1f1f1;
                border-radius: 3px;
            }
            
            .account-list::-webkit-scrollbar-thumb {
                background: #c1c1c1;
                border-radius: 3px;
            }
            
            .account-list::-webkit-scrollbar-thumb:hover {
                background: #a8a8a8;
            }
            
            .account-item {
                padding: 10px;
                border: 1px solid #e0e0e0;
                border-radius: 4px;
                margin-bottom: 10px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                box-sizing: border-box;
                overflow: hidden;
            }

            .account-env-tag {
                display: inline-block;
                margin-left: 8px;
                padding: 2px 6px;
                font-size: 12px;
                border-radius: 10px;
                background: #f0f0f0;
                color: #333;
                vertical-align: middle;
            }
            /* 环境悬浮快速切换弹窗样式 */
            .env-quick-menu {
                position: fixed;
                z-index: 99999;
                width: 220px;
                max-height: 260px;
                background: white;
                border: 1px solid #ddd;
                box-shadow: 0 6px 18px rgba(0,0,0,0.12);
                border-radius: 6px;
                display: flex;
                flex-direction: column;
                overflow: auto;
                padding: 6px;
                gap: 6px;
            }
            .env-quick-item {
                padding: 8px 10px;
                border-radius: 4px;
                cursor: pointer;
                display: flex;
                flex-direction: column;
                gap: 3px;
            }
            .env-quick-item:hover {
                background: #f5f5f5;
            }
            .env-quick-item .name { font-weight: bold; }
            .env-quick-item .user { font-size: 12px; color: #666; }
            
            .account-info {
                flex: 1;
                min-width: 0;
                margin-right: 10px;
            }
            
            .account-name {
                font-weight: bold;
                word-break: break-all;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            
            .account-username {
                color: #666;
                font-size: 13px;
                word-break: break-all;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            
            .account-actions {
                display: flex;
                gap: 5px;
                flex-shrink: 0;
            }
            
            .account-action {
                padding: 3px 8px;
                font-size: 12px;
                border-radius: 3px;
                cursor: pointer;
            }
            
            .account-action.edit {
                background-color: #fbbc04;
                color: white;
            }
            
            .account-action.delete {
                background-color: #ea4335;
                color: white;
            }
            
            .account-action.default {
                background-color: #34a853;
                color: white;
            }
            
            .env-settings {
                margin-top: 15px;
                flex: 1;
                overflow-y: auto;
                padding-right: 5px;
            }
            
            .env-settings::-webkit-scrollbar {
                width: 6px;
            }
            
            .env-settings::-webkit-scrollbar-track {
                background: #f1f1f1;
                border-radius: 3px;
            }
            
            .env-settings::-webkit-scrollbar-thumb {
                background: #c1c1c1;
                border-radius: 3px;
            }
            
            .env-settings::-webkit-scrollbar-thumb:hover {
                background: #a8a8a8;
            }
            
            .env-setting {
                margin-bottom: 15px;
                padding: 10px;
                border: 1px solid #e0e0e0;
                border-radius: 4px;
            }
            
            .env-name {
                font-weight: bold;
                margin-bottom: 8px;
            }
            
            .env-account-select {
                width: 100%;
                padding: 8px;
                border: 1px solid #ddd;
                border-radius: 4px;
                box-sizing: border-box;
            }
        `;
        document.head.appendChild(style);
        
        debugLog('样式已添加');
        
        // 创建环境切换器元素
        const switcher = document.createElement('div');
        switcher.className = 'env-switcher';
        
        // 创建环境切换按钮
        const envSwitcherBtn = document.createElement('div');
        envSwitcherBtn.className = 'env-switcher-btn';
        envSwitcherBtn.innerHTML = `
            <svg t="1757574763114" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="6581" width="20" height="20"><path d="M738.56 168.192l116.48 116.8a128 128 0 0 1 37.248 84.288l0.64 14.72A61.12 61.12 0 0 1 832 448H192a64 64 0 1 1 0-128h517.504l-61.312-61.376a64 64 0 0 1 90.432-90.432zM285.44 850.688l-116.48-116.864a128 128 0 0 1-37.248-84.288l-0.64-14.72a61.12 61.12 0 0 1 60.992-64H832a64 64 0 0 1 0 128l-517.504 0.064 61.312 61.376a64 64 0 0 1-90.432 90.432z" fill="#ffffff" p-id="6582" data-spm-anchor-id="a313x.search_index.0.i1.28003a81ISwaJq" class="selected"></path></svg>
        `;
        switcher.appendChild(envSwitcherBtn);
        
        // 创建环境选项
        const envOptionsElement = document.createElement('div');
        envOptionsElement.className = 'env-options';
        envOptionsElement.innerHTML = `
            <div class="env-option env-dev"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v6m-3-3h6"></path><path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0z"></path></svg><span>开发</span></div>
            <div class="env-option env-beta"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16v-4m0-4h.01"></path><path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0z"></path></svg><span>测试</span></div>
            <div class="env-option env-prod"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v8"></path><path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0z"></path></svg><span>正式</span></div>
        `;
        switcher.appendChild(envOptionsElement);
        // 创建并显示基于环境的快速切换弹窗
        function createEnvQuickMenu(envKey) {
            const menu = document.createElement('div');
            menu.className = 'env-quick-menu';

            const storedData = accountData; // 直接使用内存数据（已由 refreshAccountData 保持最新）
            const all = Object.values(storedData.accounts || {});
            const filtered = all.filter(a => (a.env || 'prod') === envKey);

            if (filtered.length === 0) {
                const empty = document.createElement('div');
                empty.textContent = '当前环境无账号';
                empty.style.padding = '8px';
                empty.style.color = '#999';
                menu.appendChild(empty);
                return menu;
            }

            filtered.forEach(acc => {
                const it = document.createElement('div');
                it.className = 'env-quick-item';
                it.innerHTML = `<div class="name">${acc.name}</div><div class="user">${acc.username}</div>`;
                it.addEventListener('click', function(e) {
                    e.stopPropagation();
                    (async () => {
                        try {
                            const protocol = window.location.protocol;
                            const curHost = window.location.hostname;
                            let baseHost = curHost;
                            if (baseHost.startsWith('dev-')) baseHost = baseHost.substring(4);
                            if (baseHost.startsWith('beta-')) baseHost = baseHost.substring(5);
                            let targetHost = baseHost;
                            if (envKey === 'dev') targetHost = 'dev-' + baseHost;
                            else if (envKey === 'beta') targetHost = 'beta-' + baseHost;

                            // 生成短期 token key，并将凭据存入 GM 存储
                            const tokenKey = 'hgj_one_token_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
                            const accountOne = {
                                id: acc.id,
                                name: acc.name,
                                username: acc.username,
                                password: acc.password
                            };
                            await DataStorage.set(tokenKey, JSON.stringify(accountOne));
                            debugLog('已将一次性凭据写入GM存储，tokenKey:', tokenKey);

                            // 打开目标登录页并通过 tokenKey 传递（更安全，不将明文凭据放入URL）
                            const newUrl = `${protocol}//${targetHost}/login?hgj_one_token=${encodeURIComponent(tokenKey)}&hgj_one_ts=${Date.now()}`;
                            window.open(newUrl, '_blank');
                        } catch (err) {
                            debugError('打开一次性切换页失败 (token方案):', err);
                        }
                    })();
                });
                menu.appendChild(it);
            });

            return menu;
        }

        // 将 env-option 的悬停显示逻辑抽取为可复用的函数，便于对克隆元素也绑定事件
        function attachEnvOptionHover(el) {
            if (!el) return;
            let hoverTimer = null;
            let quickMenu = null;

            // 根据 class 确定环境 key
            let key = 'prod';
            if (el.classList.contains('env-dev')) key = 'dev';
            else if (el.classList.contains('env-beta')) key = 'beta';

            el.addEventListener('mouseenter', function(e) {
                clearTimeout(hoverTimer);
                // 刷新内存数据再创建菜单
                refreshAccountData().then(() => {
                    if (quickMenu) {
                        try { quickMenu.remove(); } catch (e) {}
                        quickMenu = null;
                    }
                    quickMenu = createEnvQuickMenu(key);
                    // 使用 showMenuAutoAlign 将菜单追加到 body 并自动对齐
                    showMenuAutoAlign(quickMenu, el, `envQuick-${key}`);

                    // 当鼠标进入菜单时取消移除；离开时延迟移除
                    quickMenu.addEventListener('mouseenter', function() {
                        clearTimeout(hoverTimer);
                    });
                    quickMenu.addEventListener('mouseleave', function() {
                        hoverTimer = setTimeout(() => {
                            if (quickMenu) {
                                try { quickMenu.remove(); } catch (e) {}
                                quickMenu = null;
                            }
                        }, 200);
                    });
                }).catch(err => debugError('刷新数据失败:', err));
            });

            el.addEventListener('mouseleave', function() {
                // 延迟移除以便菜单可以被 hover
                hoverTimer = setTimeout(() => {
                    if (quickMenu) {
                        try { quickMenu.remove(); } catch (e) {}
                        quickMenu = null;
                    }
                }, 200);
            });

            // 如果鼠标移入菜单，取消移除
            document.addEventListener('mouseover', function(e) {
                if (quickMenu && quickMenu.contains(e.target)) {
                    clearTimeout(hoverTimer);
                }
            });
        }

        // 为原始的 envOptionsElement 的子项绑定事件
        ['env-dev', 'env-beta', 'env-prod'].forEach(cls => {
            const el = envOptionsElement.querySelector(`.${cls}`);
            attachEnvOptionHover(el);
        });
        
        // 创建账号管理按钮
        const accountManagerBtn = document.createElement('div');
        accountManagerBtn.className = 'account-manager-btn';
        accountManagerBtn.innerHTML = '<span>👤</span>';
        accountManagerBtn.title = '账号管理';
        switcher.appendChild(accountManagerBtn);
        
        // 添加到页面
        document.body.appendChild(switcher);
        debugLog('环境切换器已添加到页面');

        // 在 switcher 已添加到页面后注册位置同步监听器
        try {
            const applyRemotePosition = throttle((newValue) => {
                if (!newValue) return;
                try {
                    const pos = JSON.parse(newValue);
                    if (pos.left && pos.top && switcher) {
                        switcher.style.left = pos.left;
                        switcher.style.top = pos.top;
                        switcher.style.right = 'auto';
                        switcher.style.bottom = 'auto';
                        debugLog('已应用远程同步的位置 (post-create):', pos);
                    }
                } catch (e) {
                    debugError('解析位置数据失败 (post-create):', e);
                }
            }, 200);

            DataStorage.addListener('hgj_env_switcher_position', (name, oldValue, newValue, remote) => {
                debugLog('收到位置变化通知 (post-create):', { name, oldValue, newValue, remote });
                applyRemotePosition(newValue);
            });
            debugLog('位置同步监听器已注册（创建后）');
        } catch (e) {
            debugWarn('注册位置同步监听器（创建后）失败:', e);
        }
        
        // 创建账号管理弹窗
        const accountModal = document.createElement('div');
        accountModal.className = 'account-modal';
        accountModal.innerHTML = `
            <div class="account-modal-content">
                <div class="account-modal-header">
                    <div>账号管理</div>
                    <div class="account-modal-close">×</div>
                </div>
                <div class="account-modal-body">
                    <div class="account-tabs">
                        <div class="account-tab active" data-tab="accounts">账号列表</div>
                        <div class="account-tab" data-tab="settings">环境设置</div>
                    </div>
                    
                    <div class="account-tab-content active" id="accounts-tab">
                        <div class="account-form">
                            <div class="form-group">
                                <label for="account-name">账号名称</label>
                                <input type="text" id="account-name" placeholder="给这个账号起个名字">
                            </div>
                            <div class="form-group">
                                <label for="account-username">用户名</label>
                                <input type="text" id="account-username" placeholder="输入用户名">
                            </div>
                            <div class="form-group">
                                <label for="account-password">密码</label>
                                <input type="password" id="account-password" placeholder="输入密码">
                            </div>
                            <div class="form-group">
                                <label for="account-env">所属环境</label>
                                <select id="account-env" class="env-account-select">
                                    <option value="dev">开发</option>
                                    <option value="beta">测试</option>
                                    <option value="prod" selected>生产</option>
                                </select>
                            </div>
                            <button class="btn btn-primary" id="save-account">保存账号</button>
                        </div>
                        
                        <div class="account-list" id="account-list">
                            <!-- 账号列表将通过JS动态生成 -->
                        </div>
                    </div>
                    
                    <div class="account-tab-content" id="settings-tab">
                        <div class="env-settings" id="env-settings">
                            <!-- 环境设置将通过JS动态生成 -->
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(accountModal);
        
    // 添加保存账号事件（在弹窗创建之后）
    const saveAccountBtn = document.getElementById('save-account');
    saveAccountBtn.addEventListener('click', async function() {
            const nameInput = document.getElementById('account-name');
            const usernameInput = document.getElementById('account-username');
            const passwordInput = document.getElementById('account-password');
            
            const name = nameInput.value.trim();
            const username = usernameInput.value.trim();
            const password = passwordInput.value.trim();
            const envSelect = document.getElementById('account-env');
            const env = envSelect ? envSelect.value : 'prod';
            
            if (!name || !username || !password) {
                alert('请填写完整的账号信息');
                return;
            }
            
            const editId = this.getAttribute('data-edit-id');
            
            if (editId !== null && editId !== undefined) {
                // 更新现有账号
                const id = parseInt(editId);
                accountData.accounts[id] = { 
                    id: id,
                    name, 
                    username, 
                    password,
                    env
                };
                this.removeAttribute('data-edit-id');
                this.textContent = '保存账号';
                debugLog('更新账号:', { id, name, username, password });
            } else {
                // 添加新账号
                const newId = Date.now(); // 使用时间戳作为唯一ID
                accountData.accounts[newId] = { 
                    id: newId,
                    name, 
                    username, 
                    password,
                    env
                };
                debugLog('添加新账号:', { id: newId, name, username, password });
            }
            
            debugLog('保存前的账号数据:', JSON.stringify(accountData, null, 2));
            saveAccountData(accountData);
            renderAccountList();
            renderEnvironmentSettings();
            
            // 清空表单
            nameInput.value = '';
            usernameInput.value = '';
            passwordInput.value = '';
            
            debugLog('账号保存完成，界面已更新');
        });
        
        // 确保默认标签页正确激活
        setTimeout(() => {
            const accountsTab = document.querySelector('[data-tab="accounts"]');
            const accountsContent = document.getElementById('accounts-tab');
            if (accountsTab && accountsContent) {
                accountsTab.classList.add('active');
                accountsContent.classList.add('active');
                debugLog('确保账号列表标签页激活');
            }
        }, 100);
        
        // 尝试从URL参数或localStorage恢复上次保存的位置
        try {
            // 首先检查URL参数中是否有位置信息
            const urlParams = new URLSearchParams(window.location.search);
            let positionData = urlParams.get('hgj_switcher_pos');
            
            debugLog('URL参数中的位置信息:', positionData);
            
            // 如果URL中没有位置信息，则从DataStorage获取（使用 Promise.then 以避免顶级 await 问题）
            if (!positionData) {
                // 仅使用 DataStorage（GM_*）读取位置，去除 localStorage 回退以确保跨页面一致性
                DataStorage.get('hgj_env_switcher_position').then(value => {
                    positionData = value;
                    debugLog('DataStorage中的位置信息:', positionData);
                }).catch(err => {
                    debugError('从DataStorage读取位置信息失败，位置将保持默认:', err);
                    // 不回退到 localStorage，避免产生跨标签不一致性
                });
            } else {
                // 如果从URL获取了位置信息，同时保存到DataStorage中（异步，失败回退到localStorage）
                // 保存位置到 DataStorage（GM_*），不再回退到 localStorage
                DataStorage.set('hgj_env_switcher_position', positionData).then(() => {
                    debugLog('已将URL位置信息保存到DataStorage:', positionData);
                }).catch(err => {
                    debugError('保存位置信息到DataStorage失败，位置可能不会持久化:', err);
                });
                // 注意：URL参数清理现在由统一的cleanUrlParameters函数处理
            }
            
            if (positionData) {
                const position = JSON.parse(positionData);
                if (position.left && position.top) {
                    switcher.style.left = position.left;
                    switcher.style.top = position.top;
                    switcher.style.right = 'auto';
                    switcher.style.bottom = 'auto';
                    debugLog('已恢复位置:', position);
                } else {
                    debugLog('位置数据格式不正确:', position);
                }
            } else {
                debugLog('没有找到位置信息，使用默认位置');
            }
        } catch (error) {
            debugError('恢复位置时出错:', error);
            debugLog('使用默认位置');
        }
        
        // 获取当前URL和主机名
        const currentUrl = window.location.href;
        const currentHostname = window.location.hostname;
        
        // 添加点击事件处理程序
        const devOption = switcher.querySelector('.env-dev');
        const betaOption = switcher.querySelector('.env-beta');
        const prodOption = switcher.querySelector('.env-prod');
        const envOptions = switcher.querySelector('.env-options');
        
        // 创建快速切换账号菜单
        async function createQuickAccountMenu() {
            // 重新从DataStorage获取最新的账号数据
            const storedData = await DataStorage.get(STORAGE_KEY);
            const currentAccountData = JSON.parse(storedData || '{"accounts": {}, "environments": {"dev": {"defaultAccountId": null}, "beta": {"defaultAccountId": null}, "prod": {"defaultAccountId": null}}}');
            
            const menu = document.createElement('div');
            menu.className = 'quick-account-menu';
            menu.style.display = 'none';
            
            const currentEnv = window.hgjEnvSwitcher ? window.hgjEnvSwitcher.getCurrentEnvironment() : 'prod';
            const defaultAccountId = currentAccountData.environments[currentEnv].defaultAccountId;
            
            // 优先使用会话中的当前账号，如果没有则使用默认账号
            const currentAccountId = sessionCurrentAccountId || defaultAccountId;
            
            debugLog('创建快速账号菜单:', {
                currentEnv,
                sessionCurrentAccountId,
                defaultAccountId,
                currentAccountId,
                willUseSession: sessionCurrentAccountId !== null
            });
            
            // 菜单标题
            const header = document.createElement('div');
            header.className = 'quick-account-header';
            header.textContent = `${currentEnv.toUpperCase()} 环境账号`;
            menu.appendChild(header);
            
            // 创建滚动容器
            const itemsContainer = document.createElement('div');
            itemsContainer.className = 'quick-account-items';
            
            // 账号列表：仅包含与当前环境匹配的账号（若未设置env则默认视为 'prod'）
            const allAccounts = Object.values(currentAccountData.accounts || {});
            debugLog('快速切换 - 读取到的全部账号:', allAccounts);
            const accounts = allAccounts.filter(a => (a.env || 'prod') === currentEnv);
            debugLog('快速切换 - 过滤后用于渲染的账号:', accounts, '当前环境:', currentEnv);
            if (accounts.length === 0) {
                const noAccount = document.createElement('div');
                noAccount.textContent = '暂无账号';
                noAccount.style.padding = '10px';
                noAccount.style.color = '#999';
                itemsContainer.appendChild(noAccount);
            } else {
                accounts.forEach(account => {
                    const item = document.createElement('div');
                    item.className = 'quick-account-item';
                    // 使用会话当前账号或默认账号来标记当前选中状态
                    if (account.id === currentAccountId) {
                        item.classList.add('quick-account-current');
                    }
                    
                    const name = document.createElement('div');
                    name.className = 'quick-account-name';
                    name.textContent = account.name;
                    
                    const username = document.createElement('div');
                    username.className = 'quick-account-username';
                    username.textContent = account.username;
                    
                    item.appendChild(name);
                    item.appendChild(username);
                    
                    // 点击切换账号
                    item.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        debugLog(`快速切换到账号: ${account.name}`);
                        
                        // 更新会话级别的当前账号跟踪
                        const oldSessionId = sessionCurrentAccountId;
                        setSessionCurrentAccountId(account.id);
                        debugLog(`会话当前账号已更新: ${oldSessionId} -> ${sessionCurrentAccountId} (${account.name})`);
                        
                        // 禁用自动填充，避免覆盖用户的选择
                        autoFillEnabled = false;
                        autoFillCount = 0; // 重置填充次数，为将来可能重新启用做准备
                        debugLog('已禁用自动填充并重置次数，避免覆盖用户选择的账号');
                        
                        // 立即更新当前菜单的显示状态，让用户看到选择生效
                        itemsContainer.querySelectorAll('.quick-account-item').forEach(menuItem => {
                            menuItem.classList.remove('quick-account-current');
                        });
                        item.classList.add('quick-account-current');
                        debugLog('菜单显示状态已立即更新');
                        
                        // 如果在登录页面，直接填充账号密码
                        if (window.hgjEnvSwitcher && window.hgjEnvSwitcher.isLoginPage()) {
                            window.hgjEnvSwitcher.fillCredentials(account);
                        } else {
                            // 清除 hgj 开头的 cookie - 使用强力模式（GM_cookie.delete 已在函数内异步处理）
                            debugLog('快速切换账号：开始清除hgj相关cookie...');
                            const clearedCount1 = clearHgjCookies();
                            const clearedCount2 = forceClearHgjCookies();
                            debugLog(`快速切换账号：已发起 ${clearedCount1 + clearedCount2} 个 hgj 相关 cookie 删除请求`);

                            // 设置为会话当前账号（不修改默认账号设置）
                            setSessionCurrentAccountId(account.id);
                            debugLog(`快速切换：设置会话当前账号为 ${account.name} (ID: ${account.id})`);

                            // 等待短延迟，确保 GM_cookie.delete 的请求已发出
                            await new Promise(resolve => setTimeout(resolve, 300));

                            // 在页面上下文里触发 Vuex logout（通过 unsafeWindow）
                            try {
                                if (unsafeWindow && unsafeWindow.$store && typeof unsafeWindow.$store.commit === 'function') {
                                    unsafeWindow.$store.commit('logout');
                                    debugLog('已通过 unsafeWindow.$store.commit("logout") 触发登出');
                                } else {
                                    debugWarn('unsafeWindow.$store.commit 不可用，无法触发 logout');
                                }
                            } catch (err) {
                                debugError('调用 unsafeWindow.$store.commit("logout") 时出错:', err);
                            }

                            // 跳转到登录页
                            try {
                                const loginUrl = window.location.origin + '/login';
                                window.location.href = loginUrl;
                                debugLog('正在跳转到登录页:', loginUrl);
                            } catch (err) {
                                debugError('跳转到登录页时出错:', err);
                            }
                        }
                        
                        // 延迟隐藏菜单，让用户能看到选择效果
                        setTimeout(() => {
                            menu.style.display = 'none';
                        }, 500);
                    });
                    
                    itemsContainer.appendChild(item);
                });
            }
            
            // 将滚动容器添加到菜单中
            menu.appendChild(itemsContainer);
            
            return menu;
        }
        
    // 环境切换函数
    async function switchEnvironment(env) {
            debugLog(`开始切换到 ${env} 环境`);
            let newHostname = currentHostname;
            
            // 移除可能存在的环境前缀
            if (newHostname.startsWith('dev-')) {
                newHostname = newHostname.substring(4);
            } else if (newHostname.startsWith('beta-')) {
                newHostname = newHostname.substring(5);
            }
            
            // 添加新的环境前缀
            if (env === 'dev') {
                newHostname = 'dev-' + newHostname;
            } else if (env === 'beta') {
                newHostname = 'beta-' + newHostname;
            }
            // 生产环境不需要前缀
            
            // 构建新URL
            let newUrl = currentUrl.replace(currentHostname, newHostname);
            
            // 确保数据同步 - 强制刷新并保存当前状态
            try {
                // 刷新当前账号数据
                await refreshAccountData();

                // 获取当前按钮位置并添加到URL参数中（优先使用DataStorage）
                let savedPosition = null;
                // 仅使用 DataStorage 读取位置，保持跨页面一致性
                try {
                    savedPosition = await DataStorage.get('hgj_env_switcher_position');
                    debugLog('从DataStorage读取到的位置:', savedPosition);
                } catch (err) {
                    debugError('从DataStorage读取位置失败，位置将保留默认:', err);
                }
                if (savedPosition) {
                    // 添加位置参数到URL
                    const urlSeparator = newUrl.includes('?') ? '&' : '?';
                    newUrl += `${urlSeparator}hgj_switcher_pos=${encodeURIComponent(savedPosition)}`;
                    debugLog('已添加位置参数到URL:', savedPosition);
                }
                
                // 添加账号数据同步参数 - 简化版本，只传递关键信息
                const currentAccountData = JSON.stringify(accountData);
                if (Object.keys(accountData.accounts).length > 0) {
                    const urlSeparator2 = newUrl.includes('?') ? '&' : '?';
                    // 压缩数据以避免URL过长
                    const compressedData = encodeURIComponent(currentAccountData);
                    if (compressedData.length < 2000) { // 限制URL长度
                        newUrl += `${urlSeparator2}hgj_account_sync=${compressedData}`;
                        debugLog('已添加账号数据同步参数');
                    } else {
                        debugWarn('账号数据过大，跳过URL同步');
                    }
                }
                
                // 添加数据同步标识，确保新页面能正确加载数据
                const dataSyncFlag = Date.now();
                const urlSeparator3 = newUrl.includes('?') ? '&' : '?';
                newUrl += `${urlSeparator3}hgj_data_sync=${dataSyncFlag}`;
                
                debugLog('最终切换URL:', newUrl);
            } catch (error) {
                debugError('准备环境切换时出错:', error);
            }
            
            // 在新窗口中打开URL
            window.open(newUrl, '_blank');
            
            // 添加切换反馈
            const option = switcher.querySelector(`.env-${env}`);
            option.style.transform = 'scale(1.2)';
            
            // 隐藏菜单
            envOptions.classList.remove('show');
            
            setTimeout(() => {
                option.style.transform = '';
            }, 300);
            
            debugLog(`已在新窗口打开 ${env} 环境`);
        }
        
        // 添加拖动功能
        let isDragging = false;
        let offsetX, offsetY;
        let startX, startY; // 记录鼠标按下时的初始位置
        let hasMoved = false; // 标记是否发生了移动
        const moveThreshold = 5; // 移动阈值，超过这个距离才算拖动
        
        switcher.addEventListener('mousedown', function(e) {
            isDragging = true;
            hasMoved = false;
            offsetX = e.clientX - switcher.getBoundingClientRect().left;
            offsetY = e.clientY - switcher.getBoundingClientRect().top;
            startX = e.clientX;
            startY = e.clientY;
            switcher.style.transition = 'none';
            
            // 拖动开始时收起浮动的 env-options 菜单
            const floatingEnvMenu = getQuickMenu('envOptions');
            if (floatingEnvMenu) {
                try {
                    floatingEnvMenu.remove();
                    debugLog('拖动开始，已收起浮动环境菜单');
                } catch (err) {
                    debugWarn('收起浮动菜单失败:', err);
                }
            }
        });
        
        document.addEventListener('mousemove', function(e) {
            if (isDragging) {
                // 计算移动距离
                const moveX = Math.abs(e.clientX - startX);
                const moveY = Math.abs(e.clientY - startY);
                
                // 如果移动距离超过阈值，标记为已移动
                if (moveX > moveThreshold || moveY > moveThreshold) {
                    hasMoved = true;
                }
                
                const x = e.clientX - offsetX;
                const y = e.clientY - offsetY;
                
                // 确保按钮不会超出屏幕边界
                const maxX = window.innerWidth - switcher.offsetWidth;
                const maxY = window.innerHeight - switcher.offsetHeight;
                
                const boundedX = Math.max(0, Math.min(x, maxX));
                const boundedY = Math.max(0, Math.min(y, maxY));
                
                switcher.style.left = boundedX + 'px';
                switcher.style.top = boundedY + 'px';
                switcher.style.right = 'auto';
                switcher.style.bottom = 'auto';
            }
        });
        
        document.addEventListener('mouseup', async function() {
            if (isDragging) {
                isDragging = false;
                switcher.style.transition = 'all 0.3s ease';

                // 保存当前位置到DataStorage
                const position = {
                    left: switcher.style.left,
                    top: switcher.style.top
                };
                try {
                    await DataStorage.set('hgj_env_switcher_position', JSON.stringify(position));
                    debugLog('位置已保存到DataStorage:', position);
                } catch (err) {
                    debugError('保存位置到DataStorage失败，位置可能不会持久化:', err);
                }
            }
        });
        
        // 添加点击事件来切换菜单的显示/隐藏
        // 环境切换按钮点击事件
        envSwitcherBtn.addEventListener('click', function(e) {
            // 阻止事件冒泡，防止触发document的点击事件
            e.stopPropagation();
            
            // 只有在非拖动状态且没有发生明显移动时才切换菜单
            if (!isDragging && !hasMoved) {
                // 使用 body 级别的浮动菜单并自动对齐，避免被父容器裁剪
                const existing = getQuickMenu('envOptions');
                if (existing) {
                    existing.remove();
                    debugLog('环境选项菜单已隐藏');
                } else {
                    // clone envOptionsElement 内容到新的菜单节点
                    const menu = envOptionsElement.cloneNode(true);
                    menu.classList.add('env-options-floating');
                    // ensure menu uses absolute positioning
                    menu.style.position = 'absolute';
                    menu.style.display = 'flex';
                    menu.style.visibility = 'hidden';
                    document.body.appendChild(menu);
                    // bind hover handlers to cloned children so floating menu works
                    ['env-dev', 'env-beta', 'env-prod'].forEach(cls => {
                        const child = menu.querySelector(`.${cls}`);
                        attachEnvOptionHover(child);
                    });
                    showMenuAutoAlign(menu, envSwitcherBtn, 'envOptions');
                    debugLog('环境选项菜单已显示（浮动，事件已绑定）');
                }
            }
            
            // 重置移动标志，为下一次点击做准备
            hasMoved = false;
        });
        
        // 整个切换器的点击事件，用于处理拖动
        switcher.addEventListener('click', function(e) {
            // 如果点击的是账号管理按钮或环境切换按钮，不处理
            if (e.target === accountManagerBtn || accountManagerBtn.contains(e.target) ||
                e.target === envSwitcherBtn || envSwitcherBtn.contains(e.target)) {
                return;
            }
            
            // 阻止事件冒泡，防止触发document的点击事件
            e.stopPropagation();
        });
        
        // Helper: get the quick menu by owner
        function getQuickMenu(owner = 'accountManager') {
            return document.querySelector(`[data-owner="${owner}"]`);
        }

        // Helper: append menu to body and auto-align left/right based on available space
        function showMenuAutoAlign(menu, btn, owner = 'accountManager') {
            try {
                menu.dataset.owner = owner;
                // use fixed positioning and viewport-based coords to avoid being trapped in stacking contexts
                menu.style.position = 'fixed';
                menu.style.display = 'flex';
                menu.style.visibility = 'hidden';
                // append to body to keep DOM simple
                document.body.appendChild(menu);

                // measure and position using viewport coordinates (getBoundingClientRect)
                const btnRect = btn.getBoundingClientRect();
                const menuWidth = menu.offsetWidth || 200;
                const menuHeight = menu.offsetHeight || 200;
                const spaceRight = window.innerWidth - btnRect.right;
                const spaceLeft = btnRect.left;
                const spaceBelow = window.innerHeight - btnRect.bottom;
                const spaceAbove = btnRect.top;

                // horizontal placement
                let left;
                if (spaceRight >= menuWidth) {
                    left = Math.min(window.innerWidth - menuWidth - 8, btnRect.right);
                    menu.classList.remove('align-left');
                    menu.classList.add('align-right');
                } else if (spaceLeft >= menuWidth) {
                    left = Math.max(8, btnRect.left - menuWidth);
                    menu.classList.remove('align-right');
                    menu.classList.add('align-left');
                } else {
                    left = Math.max(8, Math.min(window.innerWidth - menuWidth - 8, btnRect.right));
                    menu.classList.remove('align-left');
                    menu.classList.add('align-right');
                }

                // vertical placement: prefer below, else above, else clamp
                let top;
                const isEnvQuick = (typeof owner === 'string' && owner.indexOf('envQuick-') === 0) || (btn && btn.classList && btn.classList.contains('env-option'));

                if (isEnvQuick) {
                    // For env quick menus, align top with the env-option top (clamped to viewport)
                    top = Math.max(8, Math.min(window.innerHeight - menuHeight - 8, btnRect.top));
                } else if (spaceBelow >= menuHeight) {
                    top = Math.min(window.innerHeight - menuHeight - 8, btnRect.bottom);
                } else if (spaceAbove >= menuHeight) {
                    top = Math.max(8, btnRect.top - menuHeight);
                } else {
                    if (spaceBelow >= spaceAbove) {
                        top = Math.max(8, Math.min(window.innerHeight - menuHeight - 8, btnRect.bottom));
                    } else {
                        top = Math.max(8, Math.min(window.innerHeight - menuHeight - 8, btnRect.top - menuHeight));
                    }
                }

                // apply coordinates
                menu.style.left = `${Math.round(left)}px`;
                menu.style.top = `${Math.round(top)}px`;

                // enforce a very high z-index with important flag to minimize overlay issues
                try {
                    menu.style.setProperty('z-index', '2147483647', 'important');
                } catch (e) {
                    menu.style.zIndex = '2147483647';
                }

                menu.style.visibility = 'visible';
            } catch (e) {
                debugWarn('显示快速菜单时定位失败，回退为附加到按钮:', e);
                // fallback: attach to button
                try {
                    menu.style.position = '';
                    btn.appendChild(menu);
                    menu.style.display = 'flex';
                } catch (err) {
                    debugError('回退附加到按钮失败:', err);
                }
            }
        }

        // 添加账号管理按钮点击事件和悬停事件
        createQuickAccountMenu().then(quickAccountMenu => {
            let hoverTimer = null;
            
            // 鼠标悬停显示快速账号菜单
            accountManagerBtn.addEventListener('mouseenter', function() {
                clearTimeout(hoverTimer);
                hoverTimer = setTimeout(() => {
                debugLog('悬停显示菜单，当前sessionCurrentAccountId:', sessionCurrentAccountId);
                
                // 刷新账号数据并在完成后重新创建菜单以获取最新的账号信息（保证过滤生效）
                refreshAccountData().then(() => {
                    debugLog('数据刷新完成，sessionCurrentAccountId:', sessionCurrentAccountId);

                    const oldMenu = getQuickMenu('accountManager');
                    if (oldMenu) {
                        oldMenu.remove();
                    }
                    createQuickAccountMenu().then(newMenu => {
                        showMenuAutoAlign(newMenu, accountManagerBtn);
                        debugLog('快速账号菜单已更新显示');
                    }).catch(err => debugError('创建快速账号菜单失败:', err));
                }).catch(err => debugError('刷新账号数据失败，无法更新快速菜单:', err));
            }, 300); // 300ms 延迟显示
        });
        
        // 鼠标离开隐藏快速账号菜单
        accountManagerBtn.addEventListener('mouseleave', function() {
            clearTimeout(hoverTimer);
            hoverTimer = setTimeout(() => {
                const menu = getQuickMenu('accountManager');
                if (menu) {
                    // hide and remove from DOM
                    menu.style.display = 'none';
                    try { menu.remove(); } catch (e) {}
                }
            }, 200); // 200ms 延迟隐藏
        });
        
        // 快速账号菜单内部鼠标事件处理
        accountManagerBtn.addEventListener('mouseenter', function(e) {
            if (e.target.closest('.quick-account-menu')) {
                clearTimeout(hoverTimer);
            }
        }, true);
        
        accountManagerBtn.addEventListener('click', function(e) {
            e.stopPropagation(); // 阻止事件冒泡
            
            // 如果点击的是快速账号菜单，不打开账号管理弹窗
            if (e.target.closest('.quick-account-menu')) {
                return;
            }
            
            // 隐藏快速账号菜单
            const menu = accountManagerBtn.querySelector('.quick-account-menu');
            if (menu) {
                menu.style.display = 'none';
            }
            
            // 刷新账号数据
            refreshAccountData();
            
            accountModal.classList.add('show');
            renderAccountList();
            renderEnvironmentSettings();
            
            debugLog('账号管理弹窗已打开，数据已刷新');
        });
        
        // 添加关闭弹窗事件
        const closeBtn = accountModal.querySelector('.account-modal-close');
        closeBtn.addEventListener('click', function() {
            accountModal.classList.remove('show');
        });
        
        // 点击弹窗外部关闭弹窗
        accountModal.addEventListener('click', function(e) {
            if (e.target === accountModal) {
                accountModal.classList.remove('show');
            }
        });
        
        // 标签页切换
        const tabs = accountModal.querySelectorAll('.account-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', function() {
                // 移除所有标签页的active类
                tabs.forEach(t => t.classList.remove('active'));
                // 添加当前标签页的active类
                this.classList.add('active');
                
                // 隐藏所有内容
                const contents = accountModal.querySelectorAll('.account-tab-content');
                contents.forEach(content => content.classList.remove('active'));
                
                // 显示当前标签页对应的内容
                const tabName = this.getAttribute('data-tab');
                const content = accountModal.querySelector(`#${tabName}-tab`);
                if (content) {
                    content.classList.add('active');
                }
            });
        });
        
        // 点击选项时阻止事件冒泡，防止触发document的点击事件
        devOption.addEventListener('click', function(e) {
            e.stopPropagation();
            switchEnvironment('dev');
        });
        
        betaOption.addEventListener('click', function(e) {
            e.stopPropagation();
            switchEnvironment('beta');
        });
        
        prodOption.addEventListener('click', function(e) {
            e.stopPropagation();
            switchEnvironment('prod');
        });
        
        // 点击页面其他地方时隐藏浮动菜单（envOptions/accountManager等）
        document.addEventListener('click', function() {
            try {
                const floatEnv = getQuickMenu('envOptions');
                if (floatEnv) floatEnv.remove();
            } catch (e) {}
            try {
                const floatAccount = getQuickMenu('accountManager');
                if (floatAccount) floatAccount.remove();
            } catch (e) {}
        });
        
        debugLog('HGJ环境切换器初始化完成！');
        
        // 页面卸载时清理资源
        window.addEventListener('beforeunload', () => {
            if (broadcastChannel) {
                broadcastChannel.close();
                debugLog('BroadcastChannel 已关闭');
            }
            if (syncCheckInterval) {
                clearInterval(syncCheckInterval);
                debugLog('同步检查定时器已清除');
            }
        });
        
        // 延迟刷新数据，确保跨环境同步的数据能正确加载
        setTimeout(() => {
            debugLog('执行延迟数据刷新...');
            refreshAccountData();
            
            // 如果有URL参数，再次触发数据验证
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.has('hgj_account_sync') || urlParams.has('hgj_data_sync')) {
                debugLog('检测到同步参数，重新验证数据...');
                validateAccountData();
                
                // 如果有账号管理相关的DOM元素，更新显示
                const accountList = document.getElementById('account-list');
                const envSettings = document.getElementById('env-settings');
                if (accountList || envSettings) {
                    debugLog('更新账号管理界面...');
                    if (accountList && window.renderAccountList) {
                        window.renderAccountList();
                    }
                    if (envSettings && window.renderEnvironmentSettings) {
                        window.renderEnvironmentSettings();
                    }
                }
            }
        }, 2000); // 延迟2秒确保所有同步完成
        
        }); // 闭合 createQuickAccountMenu().then()
        }
    }
    
    // 初始化脚本
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initScript);
    } else {
        initScript();
    }
})();