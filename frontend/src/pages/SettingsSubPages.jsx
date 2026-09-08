import { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { useI18n, setLanguage as setGlobalLanguage } from '../i18n/useI18n';

const BACK_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const CLOSE_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

function SubPageShell({ title, onBack, children }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      <div className="shrink-0 px-4 py-3 border-b border-border flex items-center gap-3">
        <button onClick={onBack} className="w-8 h-8 glass rounded-full flex items-center justify-center text-t2">
          {BACK_ICON}
        </button>
        <h1 className="text-lg font-semibold text-t1">{title}</h1>
      </div>
      <div className="flex-1 overflow-y-auto p-5">{children}</div>
    </div>
  );
}

// ========== 隐私与安全 ==========
export function PrivacyPage({ onBack }) {
  const { t } = useI18n();
  const settings = useAuthStore(s => s.settings);
  const updateSettings = useAuthStore(s => s.updateSettings);
  const [showVisibilityPicker, setShowVisibilityPicker] = useState(false);
  const [loginDevices] = useState([
    { name: navigator.userAgent.includes('Windows') ? 'Windows PC' : navigator.userAgent.includes('Mac') ? 'Mac' : t('privacy_currentDevice'), current: true },
  ]);

  const visibilityOptions = [
    { value: 'all', label: t('privacy_online_all') },
    { value: 'friends', label: t('privacy_online_friends') },
    { value: 'none', label: t('privacy_online_none') },
  ];

  const toggleSetting = (key) => updateSettings({ [key]: !settings[key] });

  return (
    <SubPageShell title={t('privacy_title')} onBack={onBack}>
      <div className="glass rounded-glass overflow-hidden mb-5">
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border cursor-pointer" onClick={() => setShowVisibilityPicker(!showVisibilityPicker)}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-t2" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </div>
          <div className="flex-1 text-[15px] text-t1">{t('privacy_onlineStatus')}</div>
          <span className="text-sm text-t3">{visibilityOptions.find(o => o.value === settings.onlineVisibility)?.label}</span>
        </div>
        {showVisibilityPicker && (
          <div className="px-4 pb-3">
            {visibilityOptions.map(opt => (
              <div key={opt.value} onClick={() => { updateSettings({ onlineVisibility: opt.value }); setShowVisibilityPicker(false); }} className="flex items-center gap-2 py-2 cursor-pointer">
                <div className={`w-4 h-4 rounded-full border-2 ${settings.onlineVisibility === opt.value ? 'border-accent bg-accent' : 'border-t3'}`}>
                  {settings.onlineVisibility === opt.value && <div className="w-full h-full rounded-full scale-50 bg-white" />}
                </div>
                <span className="text-sm text-t2">{opt.label}</span>
              </div>
            ))}
          </div>
        )}
        {[
          { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>, label: t('privacy_readReceipts'), key: 'showReadReceipts' },
          { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>, label: t('privacy_typing'), key: 'showTyping' },
          { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, label: t('privacy_lastSeen'), key: 'showLastSeen' },
        ].map((item, i, arr) => (
          <div key={item.key} className={`flex items-center gap-3 px-4 py-3.5 ${i < arr.length - 1 ? 'border-b border-border' : ''}`}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-t2" style={{ background: 'rgba(255,255,255,0.04)' }}>{item.icon}</div>
            <div className="flex-1 text-[15px] text-t1">{item.label}</div>
            <button onClick={() => toggleSetting(item.key)} className={`w-11 h-6 rounded-full relative transition-colors ${settings[item.key] ? 'bg-accent' : 'bg-gray-600'}`}>
              <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${settings[item.key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        ))}
      </div>
      <div className="glass rounded-glass overflow-hidden mb-5">
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-t2" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div className="flex-1 text-[15px] text-t1">{t('privacy_encryption')}</div>
          <span className="text-xs text-green font-medium">{t('privacy_encryption_enabled')}</span>
        </div>
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-t2" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
          </div>
          <div className="flex-1 text-[15px] text-t1">{t('privacy_devices')}</div>
          <span className="text-sm text-t3">{loginDevices.length}</span>
        </div>
        {loginDevices.map((d, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-t2" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            </div>
            <div className="flex-1">
              <div className="text-sm text-t1">{d.name}</div>
            </div>
            {d.current && <span className="text-xs text-green font-medium">{t('privacy_currentDevice')}</span>}
          </div>
        ))}
      </div>
      <p className="text-xs text-t3 text-center mt-4">{t('privacy_desc')}</p>
    </SubPageShell>
  );
}

// ========== 通知 ==========
export function NotificationPage({ onBack }) {
  const { t } = useI18n();
  const user = useAuthStore(s => s.user);
  const settings = useAuthStore(s => s.settings);
  const updateSettings = useAuthStore(s => s.updateSettings);
  const [announcements, setAnnouncements] = useState([]);
  const [showEditor, setShowEditor] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editId, setEditId] = useState(null);

  useEffect(() => { loadAnnouncements(); }, []);

  const loadAnnouncements = async () => {
    try {
      const endpoint = user?.isAdmin ? '/admin/announcements' : '/chat/announcements';
      const { data } = await api.get(endpoint);
      setAnnouncements(data);
    } catch {}
  };

  const handleSave = async () => {
    if (!editTitle.trim() || !editContent.trim()) return;
    try {
      if (editId) {
        await api.put(`/admin/announcements/${editId}`, { title: editTitle, content: editContent });
      } else {
        await api.post('/admin/announcements', { title: editTitle, content: editContent });
      }
      setShowEditor(false); setEditTitle(''); setEditContent(''); setEditId(null);
      loadAnnouncements();
    } catch {}
  };

  const handleDelete = async (id) => {
    if (!confirm(t('confirm'))) return;
    await api.delete(`/admin/announcements/${id}`);
    loadAnnouncements();
  };

  const toggleSetting = (key) => updateSettings({ [key]: !settings[key] });

  return (
    <SubPageShell title={t('noti_title')} onBack={onBack}>
      <div className="glass rounded-glass overflow-hidden mb-5">
        {[
          { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>, label: t('noti_sound'), key: 'notiSound' },
          { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/></svg>, label: t('noti_preview'), key: 'notiPreview' },
        ].map((item, i) => (
          <div key={item.key} className={`flex items-center gap-3 px-4 py-3.5 ${i === 0 ? 'border-b border-border' : ''}`}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-t2" style={{ background: 'rgba(255,255,255,0.04)' }}>{item.icon}</div>
            <div className="flex-1 text-[15px] text-t1">{item.label}</div>
            <button onClick={() => toggleSetting(item.key)} className={`w-11 h-6 rounded-full relative transition-colors ${settings[item.key] ? 'bg-accent' : 'bg-gray-600'}`}>
              <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${settings[item.key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        ))}
      </div>

      <div className="text-sm font-medium text-t1 mb-3">{t('noti_announcements')}</div>
      {user?.isAdmin && (
        <button onClick={() => { setEditId(null); setEditTitle(''); setEditContent(''); setShowEditor(true); }} className="w-full h-10 bg-accent rounded-full text-sm font-medium mb-4" style={{ color: '#fff' }}>
          {t('noti_publish')}
        </button>
      )}
      {announcements.length === 0 ? (
        <div className="text-center py-12">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="mx-auto text-t3 mb-3"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          <p className="text-t3 text-sm">{t('noti_empty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map(a => (
            <div key={a.id} className="glass rounded-glass p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[15px] font-semibold text-t1">{a.title}</h3>
                {user?.isAdmin && (
                  <div className="flex gap-2">
                    <button onClick={() => { setEditId(a.id); setEditTitle(a.title); setEditContent(a.content); setShowEditor(true); }} className="text-xs text-accent">{t('edit')}</button>
                    <button onClick={() => handleDelete(a.id)} className="text-xs text-red">{t('delete')}</button>
                  </div>
                )}
              </div>
              <p className="text-sm text-t2 whitespace-pre-wrap">{a.content}</p>
              <p className="text-xs text-t3 mt-2">{a.created_at}</p>
            </div>
          ))}
        </div>
      )}

      {showEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="w-80 glass rounded-glass p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-t1">{editId ? t('noti_editAnnouncement') : t('noti_publishAnnouncement')}</h2>
              <button onClick={() => { setShowEditor(false); setEditId(null); }} className="text-t3">{CLOSE_ICON}</button>
            </div>
            <input type="text" placeholder={t('noti_announcementTitle')} value={editTitle} onChange={e => setEditTitle(e.target.value)} className="w-full h-10 glass rounded-full px-4 text-sm text-t1 placeholder:text-t3 outline-none mb-3" />
            <textarea placeholder={t('noti_announcementContent')} value={editContent} onChange={e => setEditContent(e.target.value)} className="w-full h-32 glass rounded-glass px-4 py-3 text-sm text-t1 placeholder:text-t3 outline-none resize-none mb-4" />
            <button onClick={handleSave} className="w-full h-10 bg-accent rounded-full text-sm font-medium" style={{ color: '#fff' }}>{editId ? t('save') : t('noti_announcementPublish')}</button>
          </div>
        </div>
      )}
    </SubPageShell>
  );
}

// ========== 存储空间 ==========
export function StoragePage({ onBack }) {
  const { t } = useI18n();
  const user = useAuthStore(s => s.user);
  const [stats, setStats] = useState(null);
  const [clearing, setClearing] = useState(false);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    try {
      const { data: conversations } = await api.get('/chat/conversations');
      let localStorageSize = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key) && key.startsWith('pulse_')) localStorageSize += localStorage[key].length * 2;
      }
      const tokenSize = (localStorage.getItem('pulse_token') || '').length * 2;
      const avatarSize = user?.avatar ? 200 * 1024 : 0;
      let browserStorageSize = 0;
      if (navigator.storage && navigator.storage.estimate) {
        try { const est = await navigator.storage.estimate(); browserStorageSize = est.usage || 0; } catch {}
      }
      setStats({ conversations: conversations.length, localStorageSize: localStorageSize + tokenSize, avatarSize, browserStorageSize, totalSize: localStorageSize + tokenSize + avatarSize });
    } catch {}
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  const handleClearCache = () => {
    if (!confirm(t('storage_clearConfirm'))) return;
    setClearing(true);
    const keepKeys = ['pulse_token', 'pulse_user', 'pulse_lang', 'pulse_read_receipts', 'pulse_online_visibility', 'pulse_show_typing', 'pulse_show_last_seen', 'pulse_noti_sound', 'pulse_noti_preview', 'pulse_page'];
    const keysToRemove = [];
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key) && key.startsWith('pulse_') && !keepKeys.includes(key)) keysToRemove.push(key);
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    setTimeout(() => { setClearing(false); loadStats(); }, 500);
  };

  const rows = stats ? [
    { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>, label: t('storage_conversations'), value: `${stats.conversations} ${t('unit_conversations')}` },
    { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>, label: t('storage_avatar'), value: formatSize(stats.avatarSize) },
    { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>, label: t('storage_localSettings'), value: formatSize(stats.localStorageSize) },
    { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>, label: t('storage_browserTotal'), value: formatSize(stats.browserStorageSize) },
  ] : [];

  return (
    <SubPageShell title={t('storage_title')} onBack={onBack}>
      {stats ? (
        <>
          <div className="glass rounded-glass p-5 mb-5 text-center">
            <div className="text-3xl font-bold text-accent mb-1">{formatSize(stats.totalSize)}</div>
            <div className="text-sm text-t3">{t('storage_used')}</div>
          </div>
          <div className="glass rounded-glass overflow-hidden mb-5">
            {rows.map((r, i) => (
              <div key={i} className={`flex items-center justify-between px-4 py-3.5 ${i < rows.length - 1 ? 'border-b border-border' : ''}`}>
                <div className="flex items-center gap-2">{r.icon}<span className="text-sm text-t1">{r.label}</span></div>
                <span className="text-sm text-t3">{r.value}</span>
              </div>
            ))}
          </div>
          <button onClick={handleClearCache} disabled={clearing} className="w-full h-10 border border-red text-red rounded-full text-sm font-medium hover:bg-red hover:text-white transition-colors disabled:opacity-50">
            {clearing ? t('storage_clearing') : t('storage_clear')}
          </button>
          <p className="text-xs text-t3 text-center mt-3">{t('storage_clearDesc')}</p>
        </>
      ) : (
        <p className="text-t3 text-sm text-center py-8">{t('loading')}</p>
      )}
    </SubPageShell>
  );
}

// ========== 语言 ==========
export function LanguagePage({ onBack }) {
  const { t, lang } = useI18n();

  const handleSelect = (code) => setGlobalLanguage(code);

  const languages = [
    { code: 'zh', native: '简体中文', name: 'Simplified Chinese', flag: '🇨🇳' },
    { code: 'tw', native: '繁體中文', name: 'Traditional Chinese', flag: '🇹🇼' },
    { code: 'en', native: 'English', name: 'English', flag: '🇺🇸' },
    { code: 'ja', native: '日本語', name: 'Japanese', flag: '🇯🇵' },
    { code: 'ko', native: '한국어', name: 'Korean', flag: '🇰🇷' },
  ];

  return (
    <SubPageShell title={t('language_title')} onBack={onBack}>
      <div className="glass rounded-glass overflow-hidden">
        {languages.map(l => (
          <div key={l.code} onClick={() => handleSelect(l.code)} className="flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-b-0 cursor-pointer active:bg-glass-m">
            <span className="text-xl">{l.flag}</span>
            <div className="flex-1">
              <div className="text-[15px] text-t1">{l.native}</div>
              <div className="text-xs text-t3">{l.name}</div>
            </div>
            {lang === l.code && (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-t3 text-center mt-4">{t('language_restart')}</p>
    </SubPageShell>
  );
}

// ========== 关于 Pulse ==========
export function AboutPage({ onBack, onShowChangelog }) {
  const { t } = useI18n();

  const features = [
    t('about_feature_msg'), t('about_feature_call'), t('about_feature_friends'),
    t('about_feature_group'), t('about_feature_theme'), t('about_feature_read'),
  ];

  const infoRows = [
    { label: t('about_version'), value: __APP_VERSION__ },
    { label: t('about_changelog'), value: t('about_view'), isLink: true, onClick: onShowChangelog },
    { label: t('about_terms'), isArrow: true },
  ];

  return (
    <SubPageShell title={t('about_title')} onBack={onBack}>
      <div className="text-center mb-6">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center text-3xl font-bold text-white mb-3 shadow-lg shadow-accent/20">P</div>
        <h2 className="text-xl font-bold text-t1">Pulse</h2>
        <p className="text-sm text-t3">v{__APP_VERSION__}</p>
      </div>
      <div className="glass rounded-glass overflow-hidden mb-5">
        {infoRows.map((r, i) => (
          <div key={i} onClick={r.onClick} className={`flex items-center justify-between px-4 py-3.5 ${i < infoRows.length - 1 ? 'border-b border-border' : ''} ${r.onClick ? 'cursor-pointer active:bg-glass-m' : ''}`}>
            <span className="text-sm text-t1">{r.label}</span>
            {r.isLink ? <span className="text-sm text-accent">{r.value}</span> : r.isArrow ? <span className="text-t3 text-base">›</span> : <span className="text-sm text-t3">{r.value}</span>}
          </div>
        ))}
      </div>
      <div className="glass rounded-glass overflow-hidden mb-5">
        <div className="px-4 py-3.5">
          <div className="text-sm text-t1 mb-2 font-medium">{t('about_features')}</div>
          <div className="text-xs text-t3 space-y-1.5 mt-2">
            {features.map((f, i) => <p key={i}>• {f}</p>)}
          </div>
        </div>
      </div>
      <p className="text-xs text-t3 text-center mt-6">{t('about_madeWith')}</p>
    </SubPageShell>
  );
}

// ========== 更新日志 ==========
const TYPE_STYLE = {
  feat: { label: '新功能', color: 'bg-green-500/15 text-green-400' },
  fix: { label: '修复', color: 'bg-red-500/15 text-red-400' },
  style: { label: '样式', color: 'bg-blue-500/15 text-blue-400' },
  perf: { label: '优化', color: 'bg-yellow-500/15 text-yellow-400' },
};

export function ChangelogPage({ onBack }) {
  const { t } = useI18n();
  const [changelogs, setChangelogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/changelogs')
      .then(res => setChangelogs(res.data || []))
      .catch(() => setChangelogs([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <SubPageShell title={t('about_changelog')} onBack={onBack}>
      {loading ? (
        <div className="text-center text-t3 py-10">加载中...</div>
      ) : changelogs.length === 0 ? (
        <div className="text-center text-t3 py-10">暂无更新日志</div>
      ) : (
        <div className="space-y-6">
          {changelogs.map((rel, idx) => (
            <div key={rel.id} className="glass rounded-glass p-4">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-base font-bold text-t1">
                  v{rel.version}
                  {idx === 0 && <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent align-middle">最新</span>}
                </h3>
                <span className="text-xs text-t3">{rel.date}</span>
              </div>
              {rel.title && <p className="text-sm text-t2 mb-3">{rel.title}</p>}
              {rel.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {rel.tags.map(tag => (
                    <span key={tag} className="text-[11px] px-2 py-0.5 rounded-full bg-glass-m text-t3">{tag}</span>
                  ))}
                </div>
              )}
              {rel.sections?.map((sec, i) => (
                <div key={i} className="mb-4 last:mb-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${TYPE_STYLE[sec.type]?.color || 'bg-glass-m text-t3'}`}>
                      {TYPE_STYLE[sec.type]?.label || sec.type}
                    </span>
                    <span className="text-sm font-medium text-t1">{sec.title}</span>
                  </div>
                  <ul className="text-xs text-t3 space-y-1.5 pl-1">
                    {sec.items?.map((item, j) => (
                      <li key={j} className="flex gap-2">
                        <span className="text-t4 shrink-0 mt-0.5">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </SubPageShell>
  );
}

// ========== 帮助与反馈 ==========
export function HelpPage({ onBack }) {
  const { t } = useI18n();
  const user = useAuthStore(s => s.user);
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [myFeedbacks, setMyFeedbacks] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [showFeedbacks, setShowFeedbacks] = useState(false);

  const faqList = [
    { q: t('faq_addFriend_q'), a: t('faq_addFriend_a') },
    { q: t('faq_call_q'), a: t('faq_call_a') },
    { q: t('faq_pulseId_q'), a: t('faq_pulseId_a') },
    { q: t('faq_group_q'), a: t('faq_group_a') },
    { q: t('faq_sendFail_q'), a: t('faq_sendFail_a') },
    { q: t('faq_theme_q'), a: t('faq_theme_a') },
    { q: t('faq_callQuality_q'), a: t('faq_callQuality_a') },
    { q: t('faq_announcement_q'), a: t('faq_announcement_a') },
  ];

  const loadMyFeedbacks = async () => {
    try { const { data } = await api.get('/user/feedback'); setMyFeedbacks(data); } catch {}
  };

  const handleSubmit = async () => {
    if (!feedback.trim() || submitting) return;
    setSubmitting(true);
    try {
      await api.post('/user/feedback', { content: feedback });
      setSubmitted(true); setFeedback(''); loadMyFeedbacks();
      setTimeout(() => setSubmitted(false), 3000);
    } catch { } finally { setSubmitting(false); }
  };

  const statusLabel = (s) => s === 'replied' ? t('feedback_replied') : s === 'read' ? t('feedback_read') : t('feedback_pending');
  const statusClass = (s) => s === 'replied' ? 'bg-green/20 text-green' : s === 'read' ? 'bg-blue-500/20 text-blue-400' : 'bg-yellow-500/20 text-yellow-500';

  return (
    <SubPageShell title={t('help_title')} onBack={onBack}>
      <div className="glass rounded-glass p-4 mb-5 flex items-center gap-3">
        <img src={user?.avatar ? user.avatar : ''} alt="" className="w-10 h-10 rounded-full object-cover bg-glass-m" />
        <div>
          <div className="text-sm font-medium text-t1">{user?.nickname || user?.username}</div>
          <div className="text-xs text-t3">PulseID: {user?.pulseId}</div>
        </div>
      </div>

      <div className="glass rounded-glass overflow-hidden mb-5">
        <div className="px-4 py-3 border-b border-border"><div className="text-sm font-medium text-t1">{t('help_faq')}</div></div>
        {faqList.map((item, i) => (
          <div key={i} className="border-b border-border last:border-b-0">
            <div onClick={() => setExpandedFaq(expandedFaq === i ? null : i)} className="flex items-center justify-between px-4 py-3 cursor-pointer active:bg-glass-m">
              <span className="text-sm text-t1 pr-4">{item.q}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`shrink-0 text-t3 transition-transform ${expandedFaq === i ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9" /></svg>
            </div>
            {expandedFaq === i && <div className="px-4 pb-3 text-xs text-t3 leading-relaxed">{item.a}</div>}
          </div>
        ))}
      </div>

      <div className="glass rounded-glass p-4 mb-5">
        <div className="text-sm font-medium text-t1 mb-3">{t('help_feedback')}</div>
        <textarea placeholder={t('help_feedbackPlaceholder')} value={feedback} onChange={e => setFeedback(e.target.value)} className="w-full h-28 glass rounded-glass px-4 py-3 text-sm text-t1 placeholder:text-t3 outline-none resize-none mb-3" />
        <button onClick={handleSubmit} disabled={submitting} className="w-full h-10 bg-accent rounded-full text-sm font-medium disabled:opacity-50" style={{ color: '#fff' }}>{submitting ? t('help_submitting') : t('help_submit')}</button>
        {submitted && <p className="text-xs text-green text-center mt-2">{t('help_submitSuccess')}</p>}
      </div>

      <div className="glass rounded-glass overflow-hidden mb-5">
        <div onClick={() => { setShowFeedbacks(!showFeedbacks); if (!showFeedbacks) loadMyFeedbacks(); }} className="flex items-center justify-between px-4 py-3 cursor-pointer">
          <span className="text-sm font-medium text-t1">{t('help_myFeedback')}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`shrink-0 text-t3 transition-transform ${showFeedbacks ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9" /></svg>
        </div>
        {showFeedbacks && (
          <div className="px-4 pb-3">
            {myFeedbacks.length === 0 ? <p className="text-xs text-t3 py-2">{t('help_myFeedbackEmpty')}</p> : (
              <div className="space-y-3">
                {myFeedbacks.map(f => (
                  <div key={f.id} className="border-b border-border pb-3 last:border-b-0 last:pb-0">
                    <p className="text-sm text-t2">{f.content}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-t3">{f.created_at}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${statusClass(f.status)}`}>{statusLabel(f.status)}</span>
                    </div>
                    {f.admin_reply && <div className="mt-2 p-2 rounded bg-glass-m text-xs text-t2"><span className="text-accent font-medium">{t('feedback_adminReply')}</span>{f.admin_reply}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="text-center text-xs text-t3">
        <p>{t('help_contact')}</p>
        <p className="mt-1">{t('help_team')}</p>
      </div>
    </SubPageShell>
  );
}
