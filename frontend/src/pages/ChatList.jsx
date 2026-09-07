import { useEffect, useState } from 'react';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import api from '../utils/api';

const GRADIENTS = [
  'linear-gradient(135deg,#38bdf8,#0ea5e9)',
  'linear-gradient(135deg,#fbbf24,#f59e0b)',
  'linear-gradient(135deg,#a78bfa,#7c3aed)',
  'linear-gradient(135deg,#f472b6,#ec4899)',
  'linear-gradient(135deg,#22d3ee,#06b6d4)',
  'linear-gradient(135deg,#c084fc,#a855f7)',
  'linear-gradient(135deg,#fb923c,#f97316)',
  'linear-gradient(135deg,#6ee7b7,#10b981)',
];

function getGradient(name) {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

export default function ChatList({ onSelect }) {
  const conversations = useChatStore(s => s.conversations);
  const loadConversations = useChatStore(s => s.loadConversations);
  const onlineUsers = useChatStore(s => s.onlineUsers);
  const createGroup = useChatStore(s => s.createGroup);
  const { user } = useAuthStore();
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [friends, setFriends] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);

  useEffect(() => { loadConversations(); }, []);

  const loadFriends = async () => {
    try {
      const { data } = await api.get('/user/friends');
      setFriends(data);
    } catch (err) {}
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      alert('群名不能为空');
      return;
    }
    if (selectedMembers.length === 0) {
      alert('请至少选择一个成员');
      return;
    }

    try {
      await createGroup(groupName.trim(), selectedMembers);
      setShowCreateGroup(false);
      setGroupName('');
      setSelectedMembers([]);
      loadConversations();
    } catch (err) {
      alert('创建失败');
    }
  };

  const toggleMember = (friendId) => {
    setSelectedMembers(prev => 
      prev.includes(friendId) 
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    );
  };

  return (
    <div className="flex-1 overflow-y-auto hide-scroll px-3">
      {/* Create Group Button */}
      <div className="px-3 py-2 mb-2">
        <button
          onClick={() => { setShowCreateGroup(true); loadFriends(); }}
          className="w-full h-10 glass rounded-full flex items-center justify-center gap-2 text-sm font-medium"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          创建群聊
        </button>
      </div>

      {conversations.map((conv) => {
        const displayName = conv.type === 'group' ? (conv.name || '群聊') : (conv.name || '未知');
        const isOnline = conv.other && onlineUsers.has(conv.other.id);
        const lastMsg = conv.last_type === 'voice' ? '[语音通话]'
          : conv.last_type === 'video' ? '[视频通话]'
          : conv.last_type === 'image' ? '[图片]'
          : conv.last_type === 'file' ? '[文件]'
          : conv.last_type === 'system' ? '[通话记录]'
          : (conv.last_message || '');
        const timeStr = conv.last_time
          ? formatDistanceToNow(new Date(conv.last_time + 'Z'), { locale: zhCN, addSuffix: false })
          : '';

        return (
          <div
            key={conv.id}
            onClick={() => onSelect(conv)}
            className="flex items-center gap-3 px-3 py-3 rounded-glass cursor-pointer hover:bg-glass transition-colors active:bg-glass-m"
          >
            {/* Avatar */}
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white shrink-0 relative ${isOnline ? 'after:content-[""] after:absolute after:bottom-0 after:right-0 after:w-2.5 after:h-2.5 after:bg-green after:rounded-full after:border-2 after:border-[var(--bg-primary)]' : ''}`}
              style={{ background: conv.avatar ? 'transparent' : getGradient(displayName) }}
            >
              {conv.avatar ? (
                <img src={conv.avatar} alt="" className="w-full h-full object-cover rounded-full" />
              ) : (
                displayName[0]
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 border-b border-border pb-3">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[15px] font-semibold text-t1 truncate">{displayName}</span>
                <span className="text-[11px] text-t3 shrink-0 ml-2">{timeStr}</span>
              </div>
              <p className="text-[13px] text-t2 truncate">
                {conv.last_sender_id && conv.last_sender_id !== user?.id && conv.type === 'group'
                  ? `${conv.last_sender_name || ''}: ${lastMsg}`
                  : lastMsg
                }
              </p>
            </div>
          </div>
        );
      })}

      {conversations.length === 0 && (
        <div className="text-center text-t3 text-sm mt-20">
          <p className="mb-4 opacity-30">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </p>
          <p>还没有会话</p>
          <p className="text-xs mt-1">点击上方创建群聊</p>
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="w-80 glass rounded-glass p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">创建群聊</h2>
              <button onClick={() => setShowCreateGroup(false)} className="text-t3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <input
              type="text"
              placeholder="群名"
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              className="w-full h-10 glass rounded-full px-4 text-sm text-t1 placeholder:text-t3 outline-none mb-3"
            />

            <div className="text-xs font-semibold text-t3 mb-2">选择成员</div>
            <div className="max-h-60 overflow-y-auto mb-4">
              {friends.map(f => (
                <div
                  key={f.id}
                  onClick={() => toggleMember(f.id)}
                  className={`flex items-center gap-3 py-2.5 border-b border-border cursor-pointer ${selectedMembers.includes(f.id) ? 'bg-accent/10' : ''}`}
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: getGradient(f.nickname) }}>
                    {(f.nickname || '?')[0]}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{f.nickname}</div>
                    <div className="text-xs text-t3">{f.username}</div>
                  </div>
                  {selectedMembers.includes(f.id) && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-accent"><polyline points="20 6 9 17 4 12"/></svg>
                  )}
                </div>
              ))}
              {friends.length === 0 && (
                <p className="text-center text-t3 text-sm py-8">暂无好友，请先添加好友</p>
              )}
            </div>

            <button
              onClick={handleCreateGroup}
              className="w-full h-12 bg-accent text-white font-semibold rounded-full hover:opacity-90 transition-opacity"
            >
              创建群聊 ({selectedMembers.length} 人)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
