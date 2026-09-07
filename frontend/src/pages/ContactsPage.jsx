import { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { useI18n } from '../i18n/useI18n';
import api from '../utils/api';
import UserProfilePage from './UserProfilePage';

const GRADIENTS = [
  'linear-gradient(135deg,#38bdf8,#0ea5e9)',
  'linear-gradient(135deg,#fbbf24,#f59e0b)',
  'linear-gradient(135deg,#a78bfa,#7c3aed)',
  'linear-gradient(135deg,#f472b6,#ec4899)',
  'linear-gradient(135deg,#22d3ee,#06b6d4)',
  'linear-gradient(135deg,#c084fc,#a855f7)',
  'linear-gradient(135deg,#fb923c,#f97316)',
];

function getGradient(name) {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

export default function ContactsPage({ onSelectUser }) {
  const { t } = useI18n();
  const user = useAuthStore(s => s.user);
  const [friends, setFriends] = useState([]);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchUsers, setSearchUsers] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [requestHistory, setRequestHistory] = useState([]);
  const [showRequests, setShowRequests] = useState(false);
  const [requestTab, setRequestTab] = useState('pending');
  const [viewProfile, setViewProfile] = useState(null);
  const { createPrivate } = useChatStore();
  const [showQR, setShowQR] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    loadFriends();
    loadFriendRequests();
  }, []);

  const loadFriends = async () => {
    try {
      const { data } = await api.get('/user/friends');
      setFriends(data);
    } catch (err) {}
  };

  const loadFriendRequests = async () => {
    try {
      const { data } = await api.get('/user/friends/requests');
      setFriendRequests(data);
    } catch (err) {}
  };

  const loadRequestHistory = async () => {
    try {
      const { data } = await api.get('/user/friends/requests/history');
      setRequestHistory(data);
    } catch (err) {}
  };

  const handleSearchUsers = async (query) => {
    if (!query.trim() || query.trim().length < 8) {
      setSearchUsers([]);
      return;
    }
    try {
      const { data } = await api.get(`/user/search?q=${query.trim()}`);
      setSearchUsers(data);
    } catch (err) {}
  };

  const handleAddFriend = async (targetUserId) => {
    try {
      await api.post('/user/friends/request', { targetUserId });
      alert(t('contacts_requestSent'));
    } catch (err) {
      alert(err.response?.data?.error || '发送失败');
    }
  };

  const handleAcceptRequest = async (fromUserId) => {
    try {
      await api.post('/user/friends/accept', { fromUserId });
      loadFriends();
      loadFriendRequests();
    } catch (err) {
      alert('接受失败');
    }
  };

  const handleRejectRequest = async (fromUserId) => {
    try {
      await api.post('/user/friends/reject', { fromUserId });
      loadFriendRequests();
    } catch (err) {
      alert('拒绝失败');
    }
  };

  const handleStartChat = async (friend) => {
    const convId = await createPrivate(friend.id);
    onSelectUser?.(friend, convId);
  };

  // 等 video 渲染好再启动摄像头
  useEffect(() => {
    if (!showScan) return;
    let stream = null;
    let timer = null;
    let cancelled = false;

    async function initCamera() {
      // 等 video ref 挂载
      for (let i = 0; i < 20; i++) {
        if (videoRef.current) break;
        await new Promise(r => setTimeout(r, 100));
      }
      if (cancelled || !videoRef.current) {
        if (!cancelled) { alert('无法初始化摄像头'); setShowScan(false); }
        return;
      }
      try {
        // 检查是否支持 getUserMedia
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          alert('当前浏览器不支持摄像头访问，请使用 Chrome 浏览器或通过 HTTPS 访问');
          setShowScan(false);
          return;
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        // 扫码循环
        const canDetect = 'BarcodeDetector' in window;
        timer = setInterval(async () => {
          if (!videoRef.current || !canvasRef.current) return;
          if (videoRef.current.videoWidth === 0) return;
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          ctx.drawImage(videoRef.current, 0, 0);
          if (canDetect) {
            try {
              const det = new BarcodeDetector({ formats: ['qr_code'] });
              const barcodes = await det.detect(canvas);
              if (barcodes.length > 0) {
                stopScan();
                handleQRResult(barcodes[0].rawValue);
              }
            } catch (e) {}
          }
        }, 500);
      } catch (err) {
        console.error('摄像头访问失败:', err);
        if (err.name === 'NotAllowedError') {
          alert('摄像头权限被拒绝，请在浏览器设置中允许访问摄像头');
        } else if (err.name === 'NotFoundError') {
          alert('未找到摄像头设备');
        } else if (err.name === 'NotReadableError') {
          alert('摄像头被其他应用占用');
        } else {
          alert('无法访问摄像头：' + (err.message || '请使用 HTTPS 访问或使用 Chrome 浏览器'));
        }
        setShowScan(false);
      }
    }

    initCamera();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [showScan]);

  const startScan = () => {
    setShowScan(true);
  };

  const stopScan = () => {
    setShowScan(false);
  };

  const handleQRResult = (result) => {
    // 格式: pulse://addfriend/{pulseId}
    const match = result.match(/pulse:\/\/addfriend\/(\d{8,})/);
    if (match) {
      const pulseId = match[1];
      setSearchQuery(pulseId);
      setShowAdd(true);
      handleSearchUsers(pulseId);
    } else {
      alert('无效的二维码');
    }
  };

  const filtered = search
    ? friends.filter(f => f.nickname.includes(search) || f.username.includes(search) || (f.pulseId && f.pulseId.includes(search)))
    : friends;

  // 按首字母分组
  const grouped = {};
  filtered.forEach(f => {
    const letter = (f.nickname || f.username || '#')[0].toUpperCase();
    if (!grouped[letter]) grouped[letter] = [];
    grouped[letter].push(f);
  });
  const sortedLetters = Object.keys(grouped).sort();

  if (viewProfile) {
    return <UserProfilePage pulseId={viewProfile} onBack={() => setViewProfile(null)} />;
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-1 pb-3 flex items-center justify-between shrink-0">
        <h1 className="text-[30px] font-bold tracking-tight text-t1">{t('contacts_title')}</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowRequests(true)}
            className="w-9 h-9 glass rounded-full flex items-center justify-center relative"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            {friendRequests.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red text-[10px] font-bold rounded-full flex items-center justify-center" style={{color: '#fff'}}>
                {friendRequests.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="w-9 h-9 glass rounded-full flex items-center justify-center"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-6 pb-3 shrink-0">
        <input
          type="text"
          placeholder={t('contacts_searchPlaceholder')}
           value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full h-10 glass rounded-full px-4 text-sm text-t1 placeholder:text-t3 outline-none"
        />
      </div>

      {/* Friend list */}
      <div className="flex-1 overflow-y-auto hide-scroll px-6">
        {/* Quick actions */}
        <div className="mb-4">
          <button
            onClick={() => setShowQR(true)}
            className="w-full flex items-center gap-3 py-2.5"
          >
            <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center" style={{color: '#fff'}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="2" width="8" height="8" rx="1"/><rect x="14" y="2" width="8" height="8" rx="1"/><rect x="2" y="14" width="8" height="8" rx="1"/><rect x="14" y="14" width="3" height="3"/><rect x="19" y="14" width="3" height="3"/><rect x="14" y="19" width="3" height="3"/><rect x="19" y="19" width="3" height="3"/></svg>
            </div>
            <div className="flex-1 text-left">
              <div className="text-[15px] font-medium text-t1">{t('contacts_myQR')}</div>
              <div className="text-xs text-t3">{t('contacts_myQRDesc')}</div>
            </div>
          </button>
        </div>

        {sortedLetters.map(letter => (
          <div key={letter}>
            <div className="text-xs font-medium text-t3 py-1.5 sticky top-0" style={{ background: 'var(--bg-primary)' }}>{letter}</div>
            {grouped[letter].map(f => (
              <div
                key={f.id}
                className="flex items-center gap-3 py-2 cursor-pointer"
                onClick={() => setViewProfile(f.pulseId)}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                  style={{ background: f.avatar ? 'transparent' : getGradient(f.nickname) }}
                >
                  {f.avatar ? <img src={f.avatar} alt="" className="w-full h-full object-cover rounded-full" /> : (f.nickname || '?')[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-medium text-t1 truncate">{f.nickname}</div>
                  <div className="text-xs text-t3 truncate">PulseID: {f.pulseId}</div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleStartChat(f); }}
                  className="text-xs text-accent"
                >
                  {t('contacts_sendMessage')}
                </button>
              </div>
            ))}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <p className="mb-4 opacity-30">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </p>
            <p className="text-sm text-t3">{t('contacts_noFriends')}</p>
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      {showQR && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowQR(false)}>
          <div className="glass rounded-2xl p-6 text-center" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-t1 mb-4">{t('contacts_myQR')}</h2>
            <div className="bg-white rounded-xl p-4 inline-block mb-4">
              <QRCodeSVG value={`pulse://addfriend/${user?.pulseId}`} size={200} />
            </div>
            <p className="text-sm text-t3 mb-1">{user?.nickname}</p>
            <p className="text-xs text-t3">PulseID: {user?.pulseId}</p>
            <button onClick={() => setShowQR(false)} className="mt-4 px-6 py-2 glass rounded-full text-sm text-t1">{t('cancel')}</button>
          </div>
        </div>
      )}

      {/* Scan QR Modal */}
      {showScan && (
        <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50">
          <video ref={videoRef} className="w-64 h-64 object-cover rounded-xl" />
          <canvas ref={canvasRef} className="hidden" />
          <p className="text-white text-sm mt-4">{t('contacts_scan')}</p>
          <button onClick={stopScan} className="mt-4 px-6 py-2 bg-white/20 rounded-full text-white text-sm">{t('cancel')}</button>
        </div>
      )}

      {/* Add Friend Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setShowAdd(false); setSearchQuery(''); setSearchUsers([]); }}>
          <div className="w-80 glass rounded-glass p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-t1">{t('contacts_addFriend')}</h2>
              <button onClick={() => { setShowAdd(false); setSearchQuery(''); setSearchUsers([]); }} className="text-t3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <input
              type="text"
              placeholder={t('contacts_searchUserPlaceholder')}
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); handleSearchUsers(e.target.value); }}
              className="w-full h-10 glass rounded-full px-4 text-sm text-t1 placeholder:text-t3 outline-none mb-3"
            />
            <button
              onClick={() => startScan()}
              className="w-full h-10 glass rounded-full text-sm text-t1 mb-3 flex items-center justify-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              {t('contacts_scan')}
            </button>
            <div className="max-h-60 overflow-y-auto">
              {searchUsers.map(u => (
                <div key={u.id} className="flex items-center gap-3 py-2.5 border-b border-border">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white cursor-pointer"
                    style={{ background: getGradient(u.nickname) }}
                    onClick={() => { setViewProfile(u.pulseId); setShowAdd(false); }}
                  >
                    {u.avatar ? <img src={u.avatar} alt="" className="w-full h-full object-cover rounded-full" /> : (u.nickname || '?')[0]}
                  </div>
                  <div className="flex-1 cursor-pointer" onClick={() => { setViewProfile(u.pulseId); setShowAdd(false); }}>
                    <div className="text-sm font-medium text-t1">{u.nickname}</div>
                    <div className="text-xs text-t3">PulseID: {u.pulseId}</div>
                  </div>
                  <button
                    onClick={() => handleAddFriend(u.id)}
                    className="w-8 h-8 bg-accent rounded-full flex items-center justify-center"
                    style={{color: '#fff'}}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>
                </div>
              ))}
              {searchUsers.length === 0 && (
                <p className="text-center text-t3 text-sm py-8">{t('contacts_searchUserPlaceholder')}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Friend Requests Modal */}
      {showRequests && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="w-80 glass rounded-glass p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-t1">{t('contacts_friendRequests')}</h2>
              <button onClick={() => setShowRequests(false)} className="text-t3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setRequestTab('pending')}
                className={`flex-1 py-2 rounded-full text-xs font-medium transition-colors ${requestTab === 'pending' ? 'bg-accent text-white' : 'glass text-t3'}`}
              >
                {t('contacts_pending')} {friendRequests.length > 0 ? `(${friendRequests.length})` : ''}
              </button>
              <button
                onClick={() => { setRequestTab('history'); loadRequestHistory(); }}
                className={`flex-1 py-2 rounded-full text-xs font-medium transition-colors ${requestTab === 'history' ? 'bg-accent text-white' : 'glass text-t3'}`}
              >
                {t('contacts_history')}
              </button>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {requestTab === 'pending' ? (
                <>
                  {friendRequests.map(r => (
                    <div key={r.id} className="flex items-center gap-3 py-2.5 border-b border-border">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white cursor-pointer"
                        style={{ background: getGradient(r.nickname) }}
                        onClick={() => { setViewProfile(r.pulseId); setShowRequests(false); }}
                      >
                        {r.avatar ? <img src={r.avatar} alt="" className="w-full h-full object-cover rounded-full" /> : (r.nickname || '?')[0]}
                      </div>
                      <div className="flex-1 cursor-pointer" onClick={() => { setViewProfile(r.pulseId); setShowRequests(false); }}>
                        <div className="text-sm font-medium text-t1">{r.nickname}</div>
                        <div className="text-xs text-t3">PulseID: {r.pulseId}</div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAcceptRequest(r.id)}
                          className="w-8 h-8 bg-green rounded-full flex items-center justify-center"
                          style={{color: '#fff'}}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        </button>
                        <button
                          onClick={() => handleRejectRequest(r.id)}
                          className="w-8 h-8 bg-red rounded-full flex items-center justify-center"
                          style={{color: '#fff'}}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                  {friendRequests.length === 0 && (
                    <p className="text-center text-t3 text-sm py-8">{t('contacts_noFriendRequests')}</p>
                  )}
                </>
              ) : (
                <>
                  {requestHistory.map(r => (
                    <div key={r.id + r.requestTime} className="flex items-center gap-3 py-2.5 border-b border-border">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white cursor-pointer"
                        style={{ background: getGradient(r.nickname) }}
                        onClick={() => { setViewProfile(r.pulseId); setShowRequests(false); }}
                      >
                        {r.avatar ? <img src={r.avatar} alt="" className="w-full h-full object-cover rounded-full" /> : (r.nickname || '?')[0]}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-t1">{r.nickname}</div>
                        <div className="text-xs text-t3">PulseID: {r.pulseId}</div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === 'accepted' ? 'bg-green/20 text-green' : 'bg-red/20 text-red'}`}>
                        {r.status === 'accepted' ? t('contacts_accepted') : t('contacts_rejected')}
                      </span>
                    </div>
                  ))}
                  {requestHistory.length === 0 && (
                    <p className="text-center text-t3 text-sm py-8">{t('contacts_noHistory')}</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
