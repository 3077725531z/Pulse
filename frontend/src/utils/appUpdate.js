import api from './api.js';
import { resolveUrl } from './resolveUrl.js';
import { Browser } from '@capacitor/browser';

// 当前应用版本（来自 package.json，通过 vite define 注入）
const CURRENT_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

/**
 * 检查是否有新版本
 * @param {string} platform - 'android' | 'ios'
 * @param {string} channel - 'stable' | 'beta' | 'debug'
 * @returns {Promise<{has_update: boolean, latest: object|null}>}
 */
export async function checkUpdate(platform = 'android', channel = 'stable') {
  try {
    const { data } = await api.get('/app/version/check', {
      params: { platform, version: CURRENT_VERSION, channel },
    });
    return data;
  } catch (err) {
    console.warn('[AppUpdate] check failed:', err.message);
    return { has_update: false, latest: null };
  }
}

/**
 * 下载并安装 APK
 * @param {string} downloadUrl - 相对路径，如 /uploads/apps/xxx.apk
 */
export async function downloadAndInstall(downloadUrl) {
  const fullUrl = resolveUrl(downloadUrl);
  try {
    // 使用系统浏览器打开下载链接，浏览器会下载 APK 并触发安装提示
    await Browser.open({ url: fullUrl });
    return true;
  } catch (err) {
    // 降级：直接在新窗口打开
    window.open(fullUrl, '_system');
    return true;
  }
}

export { CURRENT_VERSION };
