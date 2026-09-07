import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import api from '../utils/api';

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

export default function UserProfilePage({ pulseId, onClose, onStartChat }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const { user } = useAuthStore();
  const { createPrivate } = useChatStore();

  useEffect(() => {
    loadProfile();
  }, [pulseId]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/user/profile/${pulseId}`);
      setProfile(data);
    } catch (err) {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFriend = async () => {
    if (!profile) return;
    setSending(true);
    try {
      await api.post('/user/friends/request', { targetUserId: profile.id });
      await loadProfile();
      alert('好友请求已发送');
    } catch (err) {
      alert(err.response?.data?.error || '发送失败');
    } finally {
      setSending(false);
    }
  };

  const handleStartChat = async () => {
    if (!profile) return;
    try {
      const convId = await createPrivate(profile.id);
      onStartChat?.(convId);
    } catch (err) {
      alert('操作失败');
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="text-center text-t3">加载中...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="w-80 glass rounded-glass p-5">
          <div className="text-center">
            <p className="text-t3 mb-4">用户不存在</p>
            <button onClick={onClose} className="text-accent">关闭</button>
          </div>
        </div>
      </div>
    );
  }

  const isSelf = profile.id === user?.id;
  const isFriend = profile.friendStatus === 'accepted';
  const hasPending = profile.friendStatus === 'pending';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="w-80 glass rounded-glass p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">用户主页</h2>
          <button onClick={onClose} className="text-t3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Avatar */}
        <div className="flex justify-center mb-5">
          <div 
            className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white"
            style={{ background: getGradient(profile.nickname) }}
          >
            {profile.avatar ? (
              <img src={profile.avatar} alt="avatar" className="w-full h-full object-cover rounded-full" />
            ) : (
              (profile.nickname || 'U')[0]
            )}
          </div>
        </div>

        {/* Info */}
        <div className="text-center mb-5">
          <h3 className="text-xl font-semibold mb-1">{profile.nickname}</h3>
          <p className="text-sm text-t3 mb-1">@{profile.username}</p>
          <p className="text-sm text-t3">PulseID: {profile.pulseId}</p>
          {profile.signature && (
            <p className="text-sm mt-2">{profile.signature}</p>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {isSelf ? (
            <button
              onClick={onClose}
              className="w-full h-12 glass rounded-full text-t1 font-medium"
            >
              编辑资料
            </button>
          ) : isFriend ? (
            <button
              onClick={handleStartChat}
              className="w-full h-12 bg-accent text-white font-semibold rounded-full hover:opacity-90"
            >
              发消息
            </button>
          ) : hasPending ? (
            <button
              disabled
              className="w-full h-12 glass rounded-full text-t3 font-medium cursor-not-allowed"
            >
              请求已发送
            </button>
          ) : (
            <button
              onClick={handleAddFriend}
              disabled={sending}
              className="w-full h-12 bg-accent text-white font-semibold rounded-full hover:opacity-90 disabled:opacity-50"
            >
              {sending ? '发送中...' : '添加好友'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
