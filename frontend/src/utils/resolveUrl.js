// 解析后端返回的相对 URL，加上生产服务器前缀
// 用于移动端（Capacitor），浏览器端 VITE_API_BASE 为空时原样返回
const base = import.meta.env.VITE_API_BASE || '';

export function resolveUrl(url) {
  if (!url) return url;
  // 已经是完整 URL（http/https/data/blob）直接返回
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  // 相对路径加上服务器前缀
  if (url.startsWith('/')) return base + url;
  return base + '/' + url;
}

export default resolveUrl;
