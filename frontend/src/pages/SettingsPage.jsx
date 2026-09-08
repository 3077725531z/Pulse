import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useI18n } from '../i18n/useI18n';
import EditProfilePage from './EditProfilePage';
import { PrivacyPage, NotificationPage, StoragePage, LanguagePage, AboutPage, ChangelogPage, HelpPage } from './SettingsSubPages';

export default function SettingsPage({ onNavigate }) {
  const { user, logout, updatePulseId } = useAuthStore();
  const { t } = useI18n();
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showEditPulseId, setShowEditPulseId] = useState(false);
  const [newPulseId, setNewPulseId] = useState('');
  const [pulseIdError, setPulseIdError] = useState('');
  const [pulseIdLoading, setPulseIdLoading] = useState(false);
  const [subPage, setSubPage] = useState(null);

  const handleChangePulseId = async () => {
    setPulseIdError('');
    if (!newPulseId || !/^\d{8,}$/.test(newPulseId)) {
      setPulseIdError('PulseID 必须是8位以上数字');
      return;
    }
    setPulseIdLoading(true);
    try {
      await updatePulseId(newPulseId);
      setShowEditPulseId(false);
      setNewPulseId('');
      alert('PulseID 修改成功');
    } catch (err) {
      setPulseIdError(err.response?.data?.error || '修改失败');
    } finally {
      setPulseIdLoading(false);
    }
  };

  const getPulseIdCooldown = () => {
    if (!user?.pulseIdChangedAt) return null;
    const lastChanged = new Date(user.pulseIdChangedAt);
    const now = new Date();
    const diffDays = Math.floor((now - lastChanged) / (1000 * 60 * 60 * 24));
    return diffDays < 30 ? 30 - diffDays : 0;
  };

  const cooldownDays = getPulseIdCooldown();

  const SvgIcon = ({ name }) => {
    const icons = {
      user: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
      id: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>,
      lock: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
      bell: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
      palette: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="13.5" cy="6.5" r="0.5" fill="currentColor"/><circle cx="17.5" cy="10.5" r="0.5" fill="currentColor"/><circle cx="8.5" cy="7.5" r="0.5" fill="currentColor"/><circle cx="6.5" cy="12" r="0.5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>,
      save: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
      globe: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
      info: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
      help: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
      shield: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    };
    return icons[name] || null;
  };

  const groups = [
    {
      title: t('settings_title'),
      items: [
        { icon: 'user', label: t('settings_editProfile'), color: 'var(--accent-dim)', action: () => setShowEditProfile(true) },
        { icon: 'id', label: t('settings_changePulseId'), color: 'rgba(167,139,250,0.12)', action: () => setShowEditPulseId(true) },
        { icon: 'lock', label: t('settings_privacy'), color: 'rgba(110,231,183,0.12)', action: () => setSubPage('privacy') },
        { icon: 'bell', label: t('settings_notification'), color: 'rgba(251,191,36,0.12)', action: () => setSubPage('notification') },
      ],
    },
    {
      title: '',
      items: [
        { icon: 'save', label: t('settings_storage'), color: 'rgba(34,211,238,0.12)', action: () => setSubPage('storage') },
        { icon: 'globe', label: t('settings_language'), color: 'rgba(192,132,252,0.12)', action: () => setSubPage('language') },
      ],
    },
    {
      title: '',
      items: [
        { icon: 'info', label: t('settings_about'), color: 'rgba(255,255,255,0.04)', action: () => setSubPage('about') },
        { icon: 'help', label: t('settings_help'), color: 'rgba(255,255,255,0.04)', action: () => setSubPage('help') },
      ],
    },
    ...(user?.isAdmin ? [{
      title: '',
      items: [
        { icon: 'shield', label: t('settings_admin'), color: 'rgba(239,68,68,0.12)', action: () => onNavigate?.('admin') },
      ],
    }] : []),
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-2 pb-4 shrink-0">
        <h1 className="text-[30px] font-bold tracking-tight text-t1">{t('settings_title')}</h1>
      </div>

      <div className="flex-1 overflow-y-auto hide-scroll px-4">
        {/* Profile Card */}
        <div className="glass rounded-glass p-5 flex items-center gap-3.5 mb-5">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center text-xl font-bold text-white">
            {user?.avatar ? (
              <img src={user.avatar} alt="avatar" className="w-full h-full object-cover rounded-full" />
            ) : (
              (user?.nickname || 'U')[0]
            )}
          </div>
          <div>
            <div className="text-lg font-semibold text-t1">{user?.nickname || t('login_nickname')}</div>
            <div className="text-xs text-t3">@{user?.username || ''}</div>
            <div className="text-xs text-t3">PulseID: {user?.pulseId || ''}</div>
          </div>
        </div>

        {/* Groups */}
        {groups.map(group => (
          <div key={group.title + Math.random()} className="mb-4">
            {group.title && <div className="text-[11px] font-semibold text-t3 px-1 pb-2 tracking-wide">{group.title}</div>}
            <div className="glass rounded-glass overflow-hidden">
              {group.items.map((item) => (
                <div
                  key={item.label}
                  onClick={item.action}
                  className="flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-b-0 active:bg-glass-m cursor-pointer transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-t2" style={{ background: item.color }}>
                    <SvgIcon name={item.icon} />
                  </div>
                  <div className="flex-1 text-[15px] text-t1">{item.label}</div>
                  {item.extra || <span className="text-t3 text-base">›</span>}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Logout */}
        <button onClick={logout} className="w-full h-12 glass rounded-glass text-red font-medium mt-2 mb-8 active:bg-glass-m transition-colors">
          {t('settings_logout')}
        </button>
      </div>

      {/* Edit Profile Modal */}
      {showEditProfile && <EditProfilePage onClose={() => setShowEditProfile(false)} />}

      {/* Edit PulseID Modal */}
      {showEditPulseId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="w-80 glass rounded-glass p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-t1">{t('settings_changePulseId')}</h2>
              <button onClick={() => { setShowEditPulseId(false); setPulseIdError(''); setNewPulseId(''); }} className="text-t3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="mb-4">
              <div className="text-sm text-t3 mb-2">PulseID</div>
              <div className="text-lg font-medium text-t1">{user?.pulseId || ''}</div>
            </div>
            {cooldownDays > 0 ? (
              <div className="text-sm text-red mb-4">每30天只能修改一次，还需等待 {cooldownDays} 天</div>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="PulseID"
                  value={newPulseId}
                  onChange={e => { setNewPulseId(e.target.value); setPulseIdError(''); }}
                  className="w-full h-10 glass rounded-full px-4 text-sm text-t1 placeholder:text-t3 outline-none mb-2"
                />
                {pulseIdError && <p className="text-red text-xs mb-3">{pulseIdError}</p>}
                <button onClick={handleChangePulseId} disabled={pulseIdLoading} className="w-full h-12 bg-accent font-semibold rounded-full hover:opacity-90 disabled:opacity-50" style={{color: '#fff'}}>
                  {pulseIdLoading ? '...' : t('confirm')}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Sub Pages */}
      {subPage === 'privacy' && <PrivacyPage onBack={() => setSubPage(null)} />}
      {subPage === 'notification' && <NotificationPage onBack={() => setSubPage(null)} />}
      {subPage === 'storage' && <StoragePage onBack={() => setSubPage(null)} />}
      {subPage === 'language' && <LanguagePage onBack={() => setSubPage(null)} />}
      {subPage === 'about' && <AboutPage onBack={() => setSubPage(null)} onShowChangelog={() => setSubPage('changelog')} />}
      {subPage === 'changelog' && <ChangelogPage onBack={() => setSubPage('about')} />}
      {subPage === 'help' && <HelpPage onBack={() => setSubPage(null)} />}
    </div>
  );
}
