import { useState, useEffect, Component } from 'react';
import { useAuthStore } from './store/authStore';
import { useChatStore } from './store/chatStore';
import { useSocket } from './hooks/useSocket';
import { useI18n } from './i18n/useI18n';
import LoginPage from './pages/LoginPage';
import ChatList from './pages/ChatList';
import ChatDetail from './pages/ChatDetail';
import ContactsPage from './pages/ContactsPage';
import SettingsPage from './pages/SettingsPage';
import AdminPage from './pages/AdminPage';
import CallModal from './pages/CallModal';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#080808', color: '#f0f0f0' }}>
          <p style={{ fontSize: 16, marginBottom: 12 }}>页面加载出错</p>
          <button
            onClick={() => { localStorage.removeItem('pulse_token'); window.location.reload(); }}
            style={{ padding: '10px 24px', borderRadius: 999, background: '#7dd3fc', color: '#080808', fontWeight: 600, border: 'none' }}
          >
            重新登录
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function IncomingCallBanner() {
  const { t } = useI18n();
  const incomingCall = useChatStore(s => s.incomingCall);
  const acceptCall = useChatStore(s => s.acceptCall);
  const rejectCall = useChatStore(s => s.rejectCall);
  const getConversationPeer = useChatStore(s => s.getConversationPeer);

  if (!incomingCall) return null;

  const peer = getConversationPeer(incomingCall.conversationId);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100]">
      <div className="glass rounded-2xl p-6 text-center w-72">
        <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center text-3xl font-bold text-white bg-gradient-to-br from-accent to-purple-500">
          {peer.avatar ? (
            <img src={peer.avatar} alt="" className="w-full h-full object-cover rounded-full" />
          ) : (
            (peer.name || '?')[0]
          )}
        </div>
        <p className="text-t1 font-semibold text-lg mt-4">{peer.name}</p>
        <p className="text-t3 text-sm mt-1">
          {t('contacts_incomingCall', { type: incomingCall.callType === 'video' ? t('chat_videoCall') : t('chat_voiceCall') })}
        </p>
        <div className="flex gap-6 justify-center mt-6">
          <button
            onClick={rejectCall}
            className="w-14 h-14 bg-red rounded-full flex items-center justify-center"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 0 1-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71s-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.73-1.68-1.36-2.66-1.85a.994.994 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" fill="#080808"/>
            </svg>
          </button>
          <button
            onClick={acceptCall}
            className="w-14 h-14 bg-green rounded-full flex items-center justify-center"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#080808" xmlns="http://www.w3.org/2000/svg">
              <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function ActiveCallWrapper() {
  const activeCall = useChatStore(s => s.activeCall);
  const endCall = useChatStore(s => s.endCall);
  const getConversationPeer = useChatStore(s => s.getConversationPeer);

  if (!activeCall) return null;

  const peer = getConversationPeer(activeCall.conversationId);

  return (
    <CallModal
      callType={activeCall.callType}
      peerUserId={activeCall.peerUserId}
      conversationId={activeCall.conversationId}
      peerName={peer.name}
      peerAvatar={peer.avatar}
      incomingSignal={activeCall.incomingSignal}
      onEnd={() => endCall(activeCall.peerUserId, activeCall.conversationId)}
    />
  );
}

function AppContent() {
  const { isLoggedIn, fetchMe, fetchSettings, user } = useAuthStore();
  const { t } = useI18n();
  const [page, _setPage] = useState(() => localStorage.getItem('pulse_page') || 'home');
  const setPage = (p) => { localStorage.setItem('pulse_page', p); _setPage(p); };
  const [chatConv, setChatConv] = useState(null);   // 当前打开的会话

  useSocket();

  useEffect(() => {
    if (isLoggedIn) { fetchMe(); fetchSettings(); }
  }, [isLoggedIn]);

  if (!isLoggedIn) {
    localStorage.removeItem('pulse_page');
    return <LoginPage />;
  }

  if (page === 'admin' && user?.isAdmin) return <AdminPage onBack={() => setPage('home')} />;

  return (
    <div className="h-full flex flex-col relative">
      {/* 状态栏占位 */}
      <div className="h-14 shrink-0" />

      {/* 主内容 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {chatConv ? (
          <ChatDetail conversation={chatConv} onBack={() => setChatConv(null)} />
        ) : (
          <>
            {page === 'home' && (
              <>
                <div className="px-6 pt-1 pb-3 shrink-0">
                  <h1 className="text-[30px] font-bold tracking-tight text-t1">{t('nav_home')}</h1>
                </div>
                <ChatList onSelect={(conv) => setChatConv(conv)} />
              </>
            )}
            {page === 'contacts' && <ContactsPage />}
            {page === 'settings' && <SettingsPage onNavigate={(p) => setPage(p)} />}
          </>
        )}
      </div>

      {/* 全局来电弹窗 */}
      <IncomingCallBanner />
      {/* 全局通话组件 */}
      <ActiveCallWrapper />

      {/* 底部导航（聊天详情页隐藏） */}
      {!chatConv && (
        <div className="shrink-0 flex items-center justify-around px-5 py-2 pb-7 backdrop-blur-heavy border-t border-border" style={{ background: 'var(--bg-secondary)' }}>
          <button onClick={() => setPage('home')} className={`flex flex-col items-center gap-0.5 px-4 py-1 ${page === 'home' ? 'text-accent' : 'text-t3'}`}>
            <div className="relative">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <span className="text-[10px] font-medium">{t('nav_home')}</span>
          </button>
          <button onClick={() => setPage('contacts')} className={`flex flex-col items-center gap-0.5 px-4 py-1 ${page === 'contacts' ? 'text-accent' : 'text-t3'}`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span className="text-[10px] font-medium">{t('nav_contacts')}</span>
          </button>
          <button onClick={() => setPage('settings')} className={`flex flex-col items-center gap-0.5 px-4 py-1 ${page === 'settings' ? 'text-accent' : 'text-t3'}`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            <span className="text-[10px] font-medium">{t('nav_settings')}</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
