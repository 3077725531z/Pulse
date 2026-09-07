import { useState, useEffect } from 'react';
import axios from 'axios';

function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i] || '0 B';
}

const platformConfig = {
  android: {
    label: 'Android',
    color: '#22c55e',
    bgColor: 'rgba(34, 197, 94, 0.1)',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.523 15.3414c-.611 0-1.106-.504-1.106-1.122 0-.617.495-1.121 1.106-1.121.611 0 1.106.504 1.106 1.121 0 .618-.495 1.122-1.106 1.122m-11.046 0c-.611 0-1.106-.504-1.106-1.122 0-.617.495-1.121 1.106-1.121.611 0 1.106.504 1.106 1.121 0 .618-.495 1.122-1.106 1.122m11.43-6.034l2.027-3.515a.4213.4213 0 00-.152-.575.4213.4213 0 00-.575.152l-2.054 3.559c-1.605-.745-3.408-1.16-5.318-1.16-1.91 0-3.713.415-5.318 1.16L4.412 5.37a.4213.4213 0 00-.575-.152.4213.4213 0 00-.152.575l2.027 3.515C2.234 11.241.5 14.353.5 17.886h23c0-3.533-1.734-6.645-4.593-8.579"/>
      </svg>
    ),
  },
  ios: {
    label: 'iOS',
    color: '#a78bfa',
    bgColor: 'rgba(167, 139, 250, 0.1)',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.71 19.5c-.83 1.24-1.7 2.45-3.05 2.47-1.34.03-1.77-.79-3.3-.79-1.53 0-2.01.76-3.29.81-1.31.05-2.3-1.32-3.14-2.53C4.14 17 2.94 12.45 4.84 9.24c.95-1.66 2.72-2.7 4.61-2.73 1.29-.03 2.51.87 3.3.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.45-1.35 2.84z"/>
      </svg>
    ),
  },
  zip: {
    label: '压缩包',
    color: '#8896ab',
    bgColor: 'rgba(136, 150, 171, 0.1)',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 8v13H3V8a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1z"/>
        <path d="M3 8h18"/>
        <path d="M10 12h4"/>
      </svg>
    ),
  },
  unknown: {
    label: '文件',
    color: '#8896ab',
    bgColor: 'rgba(136, 150, 171, 0.1)',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
    ),
  },
};

export default function AppDownloadPage({ onBack }) {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadApps = async () => {
      try {
        const { data } = await axios.get('/api/apps');
        setApps(data);
      } catch (err) {
        setError('加载应用列表失败');
      } finally {
        setLoading(false);
      }
    };
    loadApps();
  }, []);

  // 分组
  const androidApps = apps.filter(a => a.platform === 'android');
  const iosApps = apps.filter(a => a.platform === 'ios');
  const otherApps = apps.filter(a => !['android', 'ios'].includes(a.platform));

  return (
    <div className="h-full flex flex-col" style={{ background: 'linear-gradient(145deg, #f0f4f8, #e8ecf4)' }}>
      {/* 顶部栏 */}
      <div className="px-6 pt-6 pb-3 flex items-center gap-3 shrink-0">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-black/5 transition-colors"
          style={{ color: '#2d3748' }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: '#2d3748' }}>App 下载</h1>
          <p className="text-xs" style={{ color: '#8896ab' }}>下载 Pulse 客户端到本地安装</p>
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto px-6 pb-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64">
            <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: '#e2e8f0', borderTopColor: '#6c9ce9' }}></div>
            <p className="text-sm mt-3" style={{ color: '#8896ab' }}>加载中...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-sm" style={{ color: '#e53e3e' }}>{error}</p>
          </div>
        ) : apps.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(108,156,233,0.1)' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#6c9ce9" strokeWidth="1.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <p className="text-sm font-medium" style={{ color: '#2d3748' }}>暂无可下载的 App</p>
            <p className="text-xs mt-1" style={{ color: '#8896ab' }}>管理员尚未上传安装包</p>
          </div>
        ) : (
          <div className="space-y-6 max-w-3xl mx-auto">
            {/* Android */}
            {androidApps.length > 0 && (
              <Section title="Android 安装包" subtitle="适用于 Android 5.0 及以上设备">
                {androidApps.map(app => (
                  <AppCard key={app.filename} app={app} />
                ))}
              </Section>
            )}

            {/* iOS */}
            {iosApps.length > 0 && (
              <Section title="iOS 安装包" subtitle="需要通过 Safari 下载并信任证书">
                {iosApps.map(app => (
                  <AppCard key={app.filename} app={app} />
                ))}
              </Section>
            )}

            {/* 其他 */}
            {otherApps.length > 0 && (
              <Section title="其他文件" subtitle="">
                {otherApps.map(app => (
                  <AppCard key={app.filename} app={app} />
                ))}
              </Section>
            )}

            {/* 使用说明 */}
            <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.05)' }}>
              <h3 className="text-sm font-semibold mb-2" style={{ color: '#2d3748' }}>安装说明</h3>
              <ul className="text-xs space-y-1.5" style={{ color: '#8896ab' }}>
                <li className="flex gap-2"><span style={{ color: '#6c9ce9' }}>Android:</span>下载 .apk 文件后点击安装，可能需要允许"未知来源"</li>
                <li className="flex gap-2"><span style={{ color: '#a78bfa' }}>iOS:</span>iOS .ipa 需通过 TestFlight 或企业证书安装，个人开发者无法直接侧载</li>
                <li className="flex gap-2"><span style={{ color: '#8896ab' }}>建议:</span>推荐通过 PWA 方式使用，浏览器打开网站 → 添加到主屏幕即可</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <div>
      <div className="mb-3">
        <h2 className="text-base font-semibold" style={{ color: '#2d3748' }}>{title}</h2>
        {subtitle && <p className="text-xs mt-0.5" style={{ color: '#8896ab' }}>{subtitle}</p>}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function AppCard({ app }) {
  const config = platformConfig[app.platform] || platformConfig.unknown;

  return (
    <div
      className="rounded-xl p-4 flex items-center gap-4 transition-all hover:shadow-md"
      style={{
        background: 'rgba(255,255,255,0.9)',
        border: '1px solid rgba(0,0,0,0.05)',
        backdropFilter: 'blur(24px)',
      }}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: config.bgColor, color: config.color }}
      >
        {config.icon}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate" style={{ color: '#2d3748' }}>{app.filename}</div>
        <div className="text-xs mt-0.5 flex items-center gap-3" style={{ color: '#8896ab' }}>
          <span>{config.label}</span>
          <span>·</span>
          <span>{formatFileSize(app.size)}</span>
          <span>·</span>
          <span>{new Date(app.uploadedAt).toLocaleDateString()}</span>
        </div>
      </div>

      <a
        href={app.url}
        download
        className="px-4 h-10 rounded-lg text-sm font-medium flex items-center gap-2 transition-all hover:opacity-90 shrink-0"
        style={{
          background: 'linear-gradient(135deg, #6c9ce9, #a5c4f7)',
          color: '#fff',
          boxShadow: '0 2px 8px rgba(108,156,233,0.25)',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        下载
      </a>
    </div>
  );
}
