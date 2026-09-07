import { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuthStore } from '../store/authStore';

// ========== 纯 CSS 图表组件 ==========

function BarChart({ data, height = 160, color = '#38bdf8', labelKey = 'date', valueKey = 'count' }) {
  if (!data || data.length === 0) return <div className="text-xs text-t3 text-center py-8">暂无数据</div>;
  const max = Math.max(...data.map(d => d[valueKey]), 1);
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
          <div className="text-[10px] text-t3 mb-1">{d[valueKey]}</div>
          <div className="w-full rounded-t-md transition-all" style={{ height: `${(d[valueKey] / max) * (height - 30)}px`, background: color, minHeight: d[valueKey] > 0 ? 4 : 0 }} />
          <div className="text-[10px] text-t3 mt-1 truncate w-full text-center">{d[labelKey]?.slice(5) || ''}</div>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ data, size = 140, colors }) {
  if (!data || data.length === 0) return <div className="text-xs text-t3 text-center py-4">暂无数据</div>;
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) return <div className="text-xs text-t3 text-center py-4">暂无数据</div>;
  const defaultColors = ['#38bdf8', '#a78bfa', '#22d3ee', '#22c55e', '#f59e0b', '#ef4444', '#ec4899'];
  const c = colors || defaultColors;
  let cumulative = 0;
  const segments = data.map((d, i) => {
    const pct = d.count / total;
    const start = cumulative;
    cumulative += pct;
    return { ...d, pct, start, color: c[i % c.length] };
  });

  const r = 50;
  const cx = 60;
  const cy = 60;
  const strokeW = 18;
  const circumference = 2 * Math.PI * r;

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox="0 0 120 120">
        {segments.map((seg, i) => (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeW}
            strokeDasharray={`${seg.pct * circumference} ${circumference}`}
            strokeDashoffset={-seg.start * circumference}
            transform="rotate(-90 60 60)"
          />
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" className="fill-t1 text-lg font-bold">{total}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" className="fill-t3 text-[10px]">总计</text>
      </svg>
      <div className="flex flex-col gap-1.5">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: seg.color }} />
            <span className="text-t2">{seg.type || seg.callType || seg.label}</span>
            <span className="text-t3">{seg.count} ({(seg.pct * 100).toFixed(0)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniLineChart({ data, color = '#38bdf8', height = 60 }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.count), 1);
  const w = 100;
  const points = data.map((d, i) => `${(i / (data.length - 1 || 1)) * w},${height - (d.count / max) * (height - 10)}`);
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth="2" points={points.join(' ')} />
      <polyline fill={`${color}20`} stroke="none" points={`0,${height} ${points.join(' ')} ${w},${height}`} />
    </svg>
  );
}

function StatCard({ label, value, icon, color, sub }) {
  return (
    <div className="glass rounded-xl p-4 relative overflow-hidden">
      <div className="absolute top-3 right-3 w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="text-sm text-t3 mb-1">{label}</div>
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
      {sub && <div className="text-xs text-t3 mt-1">{sub}</div>}
    </div>
  );
}

// ========== 主组件 ==========

export default function AdminPage({ onBack }) {
  const user = useAuthStore(s => s.user);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [friendships, setFriendships] = useState([]);
  const [calls, setCalls] = useState([]);
  const [recordings, setRecordings] = useState([]);
  const [selectedRecordings, setSelectedRecordings] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [editAnnouncement, setEditAnnouncement] = useState(null);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementContent, setAnnouncementContent] = useState('');
  const [feedbacks, setFeedbacks] = useState([]);
  const [replyingFeedback, setReplyingFeedback] = useState(null);
  const [replyContent, setReplyContent] = useState('');
  const [search, setSearch] = useState('');

  // 筛选状态
  const [callFilter, setCallFilter] = useState({ type: '', search: '' });
  const [recordingFilter, setRecordingFilter] = useState({ type: '', search: '' });
  const [friendFilter, setFriendFilter] = useState({ status: '', search: '' });
  const [convFilter, setConvFilter] = useState({ type: '', search: '' });
  const [userFilter, setUserFilter] = useState({ search: '' });
  const [dbPassword, setDbPassword] = useState('');
  const [dbRemaining, setDbRemaining] = useState(30);

  // 动态密码：前端每秒倒计时，到0时从后端刷新
  useEffect(() => {
    let mounted = true;
    const fetchPassword = async () => {
      try {
        const { data } = await api.get('/admin/db-viewer-password');
        if (mounted) { setDbPassword(data.password); setDbRemaining(data.remaining); }
      } catch {}
    };
    fetchPassword();
    const timer = setInterval(() => {
      setDbRemaining(prev => {
        if (prev <= 1) { fetchPassword(); return 30; }
        return prev - 1;
      });
    }, 1000);
    return () => { mounted = false; clearInterval(timer); };
  }, []);

  useEffect(() => { loadDashboard(); }, []);

  const loadDashboard = async () => {
    try { const { data } = await api.get('/admin/stats'); setStats(data); } catch (err) { if (err.response?.status === 403) alert('无管理员权限'); }
  };
  const loadUsers = async () => { const { data } = await api.get('/admin/users'); setUsers(data); };
  const loadConversations = async () => { const { data } = await api.get('/admin/conversations'); setConversations(data); };
  const loadMessages = async (convId) => { const { data } = await api.get(`/admin/conversations/${convId}/messages`); setMessages(data); setSelectedConv(convId); };
  const loadFriendships = async () => { const { data } = await api.get('/admin/friendships'); setFriendships(data); };
  const loadCalls = async () => { const { data } = await api.get('/admin/calls'); setCalls(data); };
  const loadRecordings = async () => { const { data } = await api.get('/admin/recordings'); setRecordings(data); };
  const loadAnnouncements = async () => { const { data } = await api.get('/admin/announcements'); setAnnouncements(data); };
  const loadFeedbacks = async () => { const { data } = await api.get('/admin/feedback'); setFeedbacks(data); };

  const handleDeleteUser = async (id) => { if (!confirm('确定删除此用户？')) return; await api.delete(`/admin/users/${id}`); loadUsers(); };
  const handleToggleAdmin = async (id, isAdmin) => { await api.put(`/admin/users/${id}/admin`, { isAdmin: !isAdmin }); loadUsers(); };
  const handleDeleteRecording = async (id) => { if (!confirm('确定删除此录制文件？')) return; await api.delete(`/admin/recordings/${id}`); setSelectedRecordings(prev => prev.filter(rid => rid !== id)); loadRecordings(); };

  const handleDownloadSingle = (id, format) => {
    const token = localStorage.getItem('pulse_token');
    const formatParam = format ? `?format=${format}` : '';
    fetch(`/api/admin/recordings/${id}/download${formatParam}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => { if (!res.ok) throw new Error('下载失败: ' + res.status); return res.blob(); })
      .then(blob => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = ''; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(a.href); })
      .catch(err => alert(err.message));
  };

  const handleDownloadZip = async () => {
    if (selectedRecordings.length === 0) return alert('请先选择录制文件');
    const token = localStorage.getItem('pulse_token');
    try {
      const res = await fetch('/api/admin/recordings/download-zip', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ ids: selectedRecordings }) });
      if (!res.ok) throw new Error('下载失败: ' + res.status);
      const blob = await res.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `recordings_${Date.now()}.zip`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(a.href);
    } catch (err) { alert('下载失败: ' + err.message); }
  };

  const toggleRecordingSelect = (id) => setSelectedRecordings(prev => prev.includes(id) ? prev.filter(rid => rid !== id) : [...prev, id]);
  const toggleSelectAllRecordings = () => { if (selectedRecordings.length === filteredRecordings.length) setSelectedRecordings([]); else setSelectedRecordings(filteredRecordings.map(r => r.id)); };

  const formatFileSize = (bytes) => { if (!bytes) return '0 B'; if (bytes < 1024) return bytes + ' B'; if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'; return (bytes / (1024 * 1024)).toFixed(1) + ' MB'; };
  const formatDuration = (seconds) => { if (!seconds) return '00:00'; const m = Math.floor(seconds / 60); const s = seconds % 60; return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`; };

  const handleTabChange = (tab) => {
    setActiveTab(tab); setSelectedConv(null); setMessages([]); setSelectedRecordings([]);
    if (tab === 'dashboard') loadDashboard();
    if (tab === 'users') loadUsers();
    if (tab === 'conversations') loadConversations();
    if (tab === 'friendships') loadFriendships();
    if (tab === 'calls') loadCalls();
    if (tab === 'recordings') loadRecordings();
    if (tab === 'announcements') loadAnnouncements();
    if (tab === 'feedback') loadFeedbacks();
  };

  // 筛选逻辑
  const filteredUsers = users.filter(u => {
    if (userFilter.search && !u.nickname?.toLowerCase().includes(userFilter.search.toLowerCase()) && !u.username?.toLowerCase().includes(userFilter.search.toLowerCase()) && !u.pulseId?.includes(userFilter.search)) return false;
    return true;
  });

  const filteredCalls = calls.filter(c => {
    if (callFilter.type && c.callType !== callFilter.type) return false;
    if (callFilter.search && !c.callerName?.toLowerCase().includes(callFilter.search.toLowerCase()) && !c.receiverName?.toLowerCase().includes(callFilter.search.toLowerCase())) return false;
    return true;
  });

  const filteredRecordings = recordings.filter(r => {
    if (recordingFilter.type && r.callType !== recordingFilter.type) return false;
    if (recordingFilter.search && !r.senderName?.toLowerCase().includes(recordingFilter.search.toLowerCase()) && !r.peerName?.toLowerCase().includes(recordingFilter.search.toLowerCase())) return false;
    return true;
  });

  const filteredFriendships = friendships.filter(f => {
    if (friendFilter.status && f.status !== friendFilter.status) return false;
    if (friendFilter.search && !f.user_name?.toLowerCase().includes(friendFilter.search.toLowerCase()) && !f.friend_name?.toLowerCase().includes(friendFilter.search.toLowerCase())) return false;
    return true;
  });

  const filteredConversations = conversations.filter(c => {
    if (convFilter.type && c.type !== convFilter.type) return false;
    if (convFilter.search && !c.name?.toLowerCase().includes(convFilter.search.toLowerCase()) && !c.members?.toLowerCase().includes(convFilter.search.toLowerCase())) return false;
    return true;
  });

  const tabs = [
    { id: 'dashboard', label: '总览', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
    { id: 'users', label: '用户', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
    { id: 'conversations', label: '会话', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
    { id: 'friendships', label: '好友关系', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> },
    { id: 'calls', label: '通话记录', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07"/></svg> },
    { id: 'recordings', label: '录制文件', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg> },
    { id: 'announcements', label: '系统公告', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> },
    { id: 'feedback', label: '用户反馈', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="9" y1="10" x2="15" y2="10"/></svg> },
  ];

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="w-8 h-8 glass rounded-full flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
          )}
          <h1 className="text-xl font-bold text-t1">管理员控制台</h1>
        </div>
        <span className="text-sm text-t3">{user?.nickname} (管理员)</span>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-48 shrink-0 border-r border-border p-3 flex flex-col gap-1">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => handleTabChange(tab.id)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${activeTab === tab.id ? 'bg-accent/15 text-accent' : 'text-t2 hover:bg-white/5'}`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ========== Dashboard ========== */}
          {activeTab === 'dashboard' && stats && (
            <div>
              <h2 className="text-lg font-semibold text-t1 mb-4">数据概览</h2>
              <div className="grid grid-cols-4 gap-4 mb-6">
                <StatCard label="总用户" value={stats.userCount} color="#38bdf8" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>} />
                <StatCard label="总消息" value={stats.msgCount} color="#a78bfa" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>} sub={`图片 ${stats.imageCount} / 文件 ${stats.fileCount}`} />
                <StatCard label="总会话" value={stats.convCount} color="#22d3ee" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>} />
                <StatCard label="总通话" value={stats.callCount} color="#22c55e" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07"/></svg>} sub={`好友 ${stats.friendCount} / 录制 ${stats.recordingCount}`} />
              </div>

              {/* 数据库可视化密码 */}
              <div className="glass rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#f59e0b15' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    </div>
                    <div>
                      <div className="text-sm text-t1 font-medium">数据库查看密码</div>
                      <div className="text-xs text-t3">每30秒自动刷新 | <a href="/db-viewer" target="_blank" className="text-accent hover:underline">打开数据库面板</a></div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-2xl font-mono font-bold px-4 py-2 rounded-lg select-all" style={{ background: 'var(--bg-secondary)', color: '#f59e0b', letterSpacing: '4px' }}>{dbPassword}</code>
                    <button
                      onClick={() => { navigator.clipboard.writeText(dbPassword).catch(() => {}); }}
                      className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
                      style={{ background: 'var(--bg-secondary)', color: '#f59e0b' }}
                      title="复制密码"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    </button>
                    <span className="text-sm font-mono font-bold px-2 py-1 rounded-lg" style={{ background: dbRemaining <= 10 ? '#ef444415' : '#f59e0b15', color: dbRemaining <= 10 ? '#ef4444' : '#f59e0b' }}>{dbRemaining}s</span>
                  </div>
                </div>
                <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-1000 ease-linear"
                    style={{
                      width: `${(dbRemaining / 30) * 100}%`,
                      background: dbRemaining <= 10 ? '#ef4444' : '#f59e0b',
                      transition: 'width 1s linear',
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                {/* 用户增长 */}
                <div className="glass rounded-xl p-4">
                  <div className="text-sm font-medium text-t1 mb-3">近7天用户增长</div>
                  <MiniLineChart data={stats.userGrowth} color="#38bdf8" />
                  <div className="mt-2"><BarChart data={stats.userGrowth} height={100} color="#38bdf8" /></div>
                </div>
                {/* 消息趋势 */}
                <div className="glass rounded-xl p-4">
                  <div className="text-sm font-medium text-t1 mb-3">近7天消息趋势</div>
                  <MiniLineChart data={stats.msgTrend} color="#a78bfa" />
                  <div className="mt-2"><BarChart data={stats.msgTrend} height={100} color="#a78bfa" /></div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                {/* 消息类型分布 */}
                <div className="glass rounded-xl p-4">
                  <div className="text-sm font-medium text-t1 mb-3">消息类型分布</div>
                  <DonutChart data={stats.msgTypeDist} />
                </div>
                {/* 通话类型分布 */}
                <div className="glass rounded-xl p-4">
                  <div className="text-sm font-medium text-t1 mb-3">通话类型分布</div>
                  <DonutChart data={stats.callTypeDist} colors={['#22c55e', '#38bdf8']} />
                </div>
                {/* 会话类型分布 */}
                <div className="glass rounded-xl p-4">
                  <div className="text-sm font-medium text-t1 mb-3">会话类型分布</div>
                  <DonutChart data={stats.convTypeDist} colors={['#a78bfa', '#22d3ee']} />
                </div>
              </div>

              {/* 通话趋势 */}
              {stats.callTrend && stats.callTrend.length > 0 && (
                <div className="glass rounded-xl p-4 mb-6">
                  <div className="text-sm font-medium text-t1 mb-3">近7天通话趋势</div>
                  <BarChart data={stats.callTrend} height={120} color="#22c55e" />
                </div>
              )}

              {/* 最近注册 */}
              {stats.recentUsers && stats.recentUsers.length > 0 && (
                <div className="glass rounded-xl p-4">
                  <div className="text-sm font-medium text-t1 mb-3">最近注册用户</div>
                  <div className="space-y-2">
                    {stats.recentUsers.map((u, i) => (
                      <div key={i} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold text-accent">
                          {u.avatar ? <img src={`http://localhost:3000${u.avatar}`} alt="" className="w-full h-full object-cover rounded-full" /> : (u.nickname || '?')[0]}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm text-t1">{u.nickname}</div>
                          <div className="text-xs text-t3">@{u.username}</div>
                        </div>
                        <div className="text-xs text-t3">{u.created_at}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========== Users ========== */}
          {activeTab === 'users' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-t1">用户管理 ({filteredUsers.length}/{users.length})</h2>
                <input type="text" placeholder="搜索昵称/用户名/PulseID..." value={userFilter.search} onChange={e => setUserFilter({ ...userFilter, search: e.target.value })} className="w-64 h-9 glass rounded-lg px-3 text-sm text-t1 placeholder:text-t3 outline-none" />
              </div>
              <div className="glass rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-t3">
                    <th className="text-left py-3 px-4 font-medium">用户</th>
                    <th className="text-left py-3 px-4 font-medium">PulseID</th>
                    <th className="text-left py-3 px-4 font-medium">用户名</th>
                    <th className="text-left py-3 px-4 font-medium">主题</th>
                    <th className="text-left py-3 px-4 font-medium">管理员</th>
                    <th className="text-left py-3 px-4 font-medium">注册时间</th>
                    <th className="text-right py-3 px-4 font-medium">操作</th>
                  </tr></thead>
                  <tbody>
                    {filteredUsers.map(u => (
                      <tr key={u.id} className="border-b border-border hover:bg-white/5">
                        <td className="py-3 px-4"><div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-accent/20 rounded-full flex items-center justify-center text-xs font-bold text-accent">{u.avatar ? <img src={u.avatar} alt="" className="w-full h-full object-cover rounded-full" /> : (u.nickname || '?')[0]}</div>
                          <span className="text-t1">{u.nickname}</span>
                        </div></td>
                        <td className="py-3 px-4 text-t2 font-mono">{u.pulseId}</td>
                        <td className="py-3 px-4 text-t2">{u.username}</td>
                        <td className="py-3 px-4 text-t2">{u.theme}</td>
                        <td className="py-3 px-4">{u.isAdmin ? <span className="text-accent">是</span> : <span className="text-t3">否</span>}</td>
                        <td className="py-3 px-4 text-t3">{u.createdAt}</td>
                        <td className="py-3 px-4 text-right">
                          <button onClick={() => handleToggleAdmin(u.id, u.isAdmin)} className="text-xs text-accent mr-3">{u.isAdmin ? '取消管理员' : '设为管理员'}</button>
                          <button onClick={() => handleDeleteUser(u.id)} className="text-xs text-red">删除</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========== Conversations ========== */}
          {activeTab === 'conversations' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-t1">会话列表 ({filteredConversations.length}/{conversations.length})</h2>
                <div className="flex gap-2">
                  <select value={convFilter.type} onChange={e => setConvFilter({ ...convFilter, type: e.target.value })} className="h-9 glass rounded-lg px-3 text-sm text-t1 outline-none">
                    <option value="">全部类型</option>
                    <option value="private">私聊</option>
                    <option value="group">群聊</option>
                  </select>
                  <input type="text" placeholder="搜索会话/成员..." value={convFilter.search} onChange={e => setConvFilter({ ...convFilter, search: e.target.value })} className="w-48 h-9 glass rounded-lg px-3 text-sm text-t1 placeholder:text-t3 outline-none" />
                </div>
              </div>
              {!selectedConv ? (
                <div className="space-y-2">
                  {filteredConversations.map(c => (
                    <div key={c.id} className="glass rounded-xl p-4 cursor-pointer hover:bg-white/5" onClick={() => loadMessages(c.id)}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-t1 font-medium">{c.name || c.type}</div>
                          <div className="text-xs text-t3 mt-1">成员: {c.members}</div>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${c.type === 'group' ? 'bg-accent/20 text-accent' : 'bg-green/20 text-green'}`}>{c.type === 'group' ? '群聊' : '私聊'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  <button onClick={() => { setSelectedConv(null); setMessages([]); }} className="text-sm text-accent mb-4">← 返回列表</button>
                  <div className="glass rounded-xl p-4 max-h-[600px] overflow-y-auto">
                    {messages.map(m => (
                      <div key={m.id} className="py-2 border-b border-border last:border-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-t1">{m.sender_name}</span>
                          <span className="text-xs text-t3">{m.created_at}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-t3">{m.type}</span>
                        </div>
                        {m.type === 'image' ? <img src={m.content} alt="" className="max-w-[200px] rounded-lg mt-1" /> :
                         m.type === 'file' ? <span className="text-sm text-accent">{m.content.split(': ')[0]}</span> :
                         <p className="text-sm text-t2">{m.content}</p>}
                      </div>
                    ))}
                    {messages.length === 0 && <p className="text-t3 text-sm text-center py-4">暂无消息</p>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========== Friendships ========== */}
          {activeTab === 'friendships' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-t1">好友关系 ({filteredFriendships.length}/{friendships.length})</h2>
                <div className="flex gap-2">
                  <select value={friendFilter.status} onChange={e => setFriendFilter({ ...friendFilter, status: e.target.value })} className="h-9 glass rounded-lg px-3 text-sm text-t1 outline-none">
                    <option value="">全部状态</option>
                    <option value="accepted">已接受</option>
                    <option value="pending">待处理</option>
                    <option value="rejected">已拒绝</option>
                  </select>
                  <input type="text" placeholder="搜索用户..." value={friendFilter.search} onChange={e => setFriendFilter({ ...friendFilter, search: e.target.value })} className="w-48 h-9 glass rounded-lg px-3 text-sm text-t1 placeholder:text-t3 outline-none" />
                </div>
              </div>
              <div className="glass rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-t3">
                    <th className="text-left py-3 px-4 font-medium">用户</th>
                    <th className="text-left py-3 px-4 font-medium">PulseID</th>
                    <th className="text-center py-3 px-4 font-medium">→</th>
                    <th className="text-left py-3 px-4 font-medium">好友</th>
                    <th className="text-left py-3 px-4 font-medium">PulseID</th>
                    <th className="text-left py-3 px-4 font-medium">状态</th>
                    <th className="text-left py-3 px-4 font-medium">时间</th>
                  </tr></thead>
                  <tbody>
                    {filteredFriendships.map((f, i) => (
                      <tr key={i} className="border-b border-border hover:bg-white/5">
                        <td className="py-3 px-4 text-t1">{f.user_name}</td>
                        <td className="py-3 px-4 text-t2 font-mono">{f.user_pulse_id}</td>
                        <td className="py-3 px-4 text-center text-t3">→</td>
                        <td className="py-3 px-4 text-t1">{f.friend_name}</td>
                        <td className="py-3 px-4 text-t2 font-mono">{f.friend_pulse_id}</td>
                        <td className="py-3 px-4">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${f.status === 'accepted' ? 'bg-green/20 text-green' : f.status === 'rejected' ? 'bg-red/20 text-red' : 'bg-yellow/20 text-yellow'}`}>
                            {f.status === 'accepted' ? '已接受' : f.status === 'rejected' ? '已拒绝' : '待处理'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-t3">{f.created_at}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========== Calls ========== */}
          {activeTab === 'calls' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-t1">通话记录 ({filteredCalls.length}/{calls.length})</h2>
                <div className="flex gap-2">
                  <select value={callFilter.type} onChange={e => setCallFilter({ ...callFilter, type: e.target.value })} className="h-9 glass rounded-lg px-3 text-sm text-t1 outline-none">
                    <option value="">全部类型</option>
                    <option value="voice">语音通话</option>
                    <option value="video">视频通话</option>
                  </select>
                  <input type="text" placeholder="搜索用户..." value={callFilter.search} onChange={e => setCallFilter({ ...callFilter, search: e.target.value })} className="w-48 h-9 glass rounded-lg px-3 text-sm text-t1 placeholder:text-t3 outline-none" />
                </div>
              </div>
              <div className="glass rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-t3">
                    <th className="text-left py-3 px-4 font-medium">类型</th>
                    <th className="text-left py-3 px-4 font-medium">发起方</th>
                    <th className="text-left py-3 px-4 font-medium">接收方</th>
                    <th className="text-left py-3 px-4 font-medium">时长</th>
                    <th className="text-left py-3 px-4 font-medium">状态</th>
                    <th className="text-left py-3 px-4 font-medium">时间</th>
                  </tr></thead>
                  <tbody>
                    {filteredCalls.map(c => (
                      <tr key={c.id} className="border-b border-border hover:bg-white/5">
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${c.callType === 'video' ? 'bg-accent/20 text-accent' : 'bg-green/20 text-green'}`}>
                            {c.callType === 'video' ? '📹 视频' : '📞 语音'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-t1">{c.callerName}</td>
                        <td className="py-3 px-4 text-t2">{c.receiverName}</td>
                        <td className="py-3 px-4 text-t2 font-mono">{formatDuration(c.duration)}</td>
                        <td className="py-3 px-4">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${c.status === 'answered' ? 'bg-green/20 text-green' : c.status === 'rejected' ? 'bg-red/20 text-red' : 'bg-yellow/20 text-yellow'}`}>
                            {c.status === 'answered' ? '已接听' : c.status === 'rejected' ? '已拒绝' : c.status === 'missed' ? '未接' : c.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-t3 text-xs">{c.createdAt}</td>
                      </tr>
                    ))}
                    {filteredCalls.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-t3">暂无通话记录</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========== Recordings ========== */}
          {activeTab === 'recordings' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-t1">录制文件 ({filteredRecordings.length}/{recordings.length})</h2>
                <div className="flex gap-2">
                  <select value={recordingFilter.type} onChange={e => setRecordingFilter({ ...recordingFilter, type: e.target.value })} className="h-9 glass rounded-lg px-3 text-sm text-t1 outline-none">
                    <option value="">全部类型</option>
                    <option value="voice">语音</option>
                    <option value="video">视频</option>
                  </select>
                  <input type="text" placeholder="搜索用户..." value={recordingFilter.search} onChange={e => setRecordingFilter({ ...recordingFilter, search: e.target.value })} className="w-48 h-9 glass rounded-lg px-3 text-sm text-t1 placeholder:text-t3 outline-none" />
                  {selectedRecordings.length > 0 && (
                    <button onClick={handleDownloadZip} className="px-3 h-9 bg-accent rounded-lg text-xs font-medium" style={{ color: '#080808' }}>打包下载 ({selectedRecordings.length})</button>
                  )}
                </div>
              </div>
              <div className="glass rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-t3">
                    <th className="py-3 px-4 w-10"><input type="checkbox" checked={selectedRecordings.length === filteredRecordings.length && filteredRecordings.length > 0} onChange={toggleSelectAllRecordings} className="accent-accent" /></th>
                    <th className="text-left py-3 px-4 font-medium">类型</th>
                    <th className="text-left py-3 px-4 font-medium">发送者</th>
                    <th className="text-left py-3 px-4 font-medium">对方</th>
                    <th className="text-left py-3 px-4 font-medium">会话</th>
                    <th className="text-left py-3 px-4 font-medium">时长</th>
                    <th className="text-left py-3 px-4 font-medium">文件大小</th>
                    <th className="text-left py-3 px-4 font-medium">录制时间</th>
                    <th className="text-right py-3 px-4 font-medium">操作</th>
                  </tr></thead>
                  <tbody>
                    {filteredRecordings.map(r => (
                      <tr key={r.id} className="border-b border-border hover:bg-white/5">
                        <td className="py-3 px-4"><input type="checkbox" checked={selectedRecordings.includes(r.id)} onChange={() => toggleRecordingSelect(r.id)} className="accent-accent" /></td>
                        <td className="py-3 px-4"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${r.callType === 'video' ? 'bg-accent/20 text-accent' : 'bg-green/20 text-green'}`}>{r.callType === 'video' ? '📹 视频' : '📞 语音'}</span></td>
                        <td className="py-3 px-4 text-t1">{r.senderName}</td>
                        <td className="py-3 px-4 text-t2">{r.peerName || '-'}</td>
                        <td className="py-3 px-4 text-t2">{r.convName || '-'}</td>
                        <td className="py-3 px-4 text-t2 font-mono">{formatDuration(r.duration)}</td>
                        <td className="py-3 px-4 text-t2">{formatFileSize(r.fileSize)}</td>
                        <td className="py-3 px-4 text-t3 text-xs">{r.createdAt}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button onClick={() => handleDownloadSingle(r.id)} className="text-xs text-accent hover:underline">原格式</button>
                            <span className="text-t3 text-xs">|</span>
                            <select onChange={(e) => { if (e.target.value) { handleDownloadSingle(r.id, e.target.value); e.target.value = ''; } }} defaultValue="" className="text-xs bg-transparent text-accent outline-none cursor-pointer">
                              <option value="" disabled>转码下载</option>
                              {r.callType === 'video' ? <><option value="mp4">MP4</option><option value="webm">WebM</option></> : <><option value="mp3">MP3</option><option value="webm">WebM</option></>}
                            </select>
                            <span className="text-t3 text-xs">|</span>
                            <button onClick={() => handleDeleteRecording(r.id)} className="text-xs text-red hover:underline">删除</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredRecordings.length === 0 && <tr><td colSpan={9} className="py-8 text-center text-t3">暂无录制文件</td></tr>}
                  </tbody>
                </table>
              </div>

              {/* Preview */}
              {selectedRecordings.length === 1 && (() => {
                const r = recordings.find(rec => rec.id === selectedRecordings[0]);
                if (!r) return null;
                return (
                  <div className="mt-4 glass rounded-xl p-4">
                    <h3 className="text-sm font-medium text-t1 mb-3">预览: {r.callType === 'video' ? '视频通话' : '语音通话'} - {r.senderName}</h3>
                    {r.callType === 'video' ? <video controls src={r.filePath} className="w-full max-w-lg rounded-lg" preload="metadata" /> : <audio controls src={r.filePath} className="w-full" preload="metadata" />}
                    <div className="text-xs text-t3 mt-2">时长: {formatDuration(r.duration)} | 大小: {formatFileSize(r.fileSize)} | 格式: {r.mimeType || 'webm'}</div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ========== Announcements ========== */}
          {activeTab === 'announcements' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-t1">系统公告 ({announcements.length})</h2>
                <button onClick={() => { setEditAnnouncement({}); setAnnouncementTitle(''); setAnnouncementContent(''); }} className="px-3 py-1.5 bg-accent rounded-lg text-sm font-medium" style={{ color: '#080808' }}>+ 发布公告</button>
              </div>
              {announcements.length === 0 ? (
                <div className="glass rounded-xl p-12 text-center">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto text-t3 mb-3"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                  <p className="text-t3">暂无公告</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {announcements.map(a => (
                    <div key={a.id} className="glass rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-[15px] font-semibold text-t1">{a.title}</h3>
                        <div className="flex gap-2">
                          <button onClick={() => { setEditAnnouncement(a); setAnnouncementTitle(a.title); setAnnouncementContent(a.content); }} className="text-xs text-accent hover:underline">编辑</button>
                          <button onClick={async () => { if (confirm('确定删除此公告？')) { await api.delete(`/admin/announcements/${a.id}`); loadAnnouncements(); } }} className="text-xs text-red hover:underline">删除</button>
                        </div>
                      </div>
                      <p className="text-sm text-t2 whitespace-pre-wrap">{a.content}</p>
                      <p className="text-xs text-t3 mt-2">{a.created_at}</p>
                    </div>
                  ))}
                </div>
              )}
              {editAnnouncement !== null && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="w-96 glass rounded-xl p-5" style={{ background: 'var(--bg-secondary)' }}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-t1">{editAnnouncement.id ? '编辑公告' : '发布公告'}</h3>
                      <button onClick={() => setEditAnnouncement(null)} className="text-t3"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                    </div>
                    <input type="text" placeholder="公告标题" value={announcementTitle} onChange={e => setAnnouncementTitle(e.target.value)} className="w-full h-10 glass rounded-lg px-3 text-sm text-t1 placeholder:text-t3 outline-none mb-3" />
                    <textarea placeholder="公告内容" value={announcementContent} onChange={e => setAnnouncementContent(e.target.value)} className="w-full h-32 glass rounded-lg px-3 py-2 text-sm text-t1 placeholder:text-t3 outline-none resize-none mb-4" />
                    <button onClick={async () => { if (!announcementTitle.trim() || !announcementContent.trim()) return alert('标题和内容不能为空'); if (editAnnouncement.id) { await api.put(`/admin/announcements/${editAnnouncement.id}`, { title: announcementTitle, content: announcementContent }); } else { await api.post('/admin/announcements', { title: announcementTitle, content: announcementContent }); } setEditAnnouncement(null); loadAnnouncements(); }} className="w-full h-10 bg-accent rounded-lg text-sm font-medium" style={{ color: '#080808' }}>{editAnnouncement.id ? '保存修改' : '发布'}</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========== Feedback ========== */}
          {activeTab === 'feedback' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-t1">用户反馈 ({feedbacks.length})</h2>
                <div className="flex gap-2 text-xs">
                  <span className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-500">待处理: {feedbacks.filter(f => f.status === 'pending').length}</span>
                  <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-400">已读: {feedbacks.filter(f => f.status === 'read').length}</span>
                  <span className="px-2 py-1 rounded bg-green/20 text-green">已回复: {feedbacks.filter(f => f.status === 'replied').length}</span>
                </div>
              </div>
              {feedbacks.length === 0 ? (
                <div className="glass rounded-xl p-12 text-center">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto text-t3 mb-3"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                  <p className="text-t3">暂无反馈</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {feedbacks.map(f => (
                    <div key={f.id} className="glass rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {f.avatar ? <img src={`http://localhost:3000${f.avatar}`} alt="" className="w-6 h-6 rounded-full object-cover" /> : <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-xs text-accent font-bold">{(f.nickname || 'U')[0]}</div>}
                          <span className="text-sm font-medium text-t1">{f.nickname}</span>
                          <span className="text-xs text-t3">@{f.username}</span>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded ${f.status === 'replied' ? 'bg-green/20 text-green' : f.status === 'read' ? 'bg-blue-500/20 text-blue-400' : 'bg-yellow-500/20 text-yellow-500'}`}>{f.status === 'replied' ? '已回复' : f.status === 'read' ? '已读' : '待处理'}</span>
                      </div>
                      <p className="text-sm text-t2 mb-2">{f.content}</p>
                      <p className="text-xs text-t3 mb-2">{f.createdAt}</p>
                      {f.adminReply && <div className="mb-2 p-2 rounded bg-glass-m text-xs text-t2"><span className="text-accent font-medium">管理员回复：</span>{f.adminReply}</div>}
                      <div className="flex gap-2">
                        {f.status === 'pending' && <button onClick={async () => { await api.put(`/admin/feedback/${f.id}/status`, { status: 'read' }); loadFeedbacks(); }} className="text-xs text-blue-400 hover:underline">标为已读</button>}
                        <button onClick={() => { setReplyingFeedback(f.id); setReplyContent(f.adminReply || ''); }} className="text-xs text-accent hover:underline">回复</button>
                        <button onClick={async () => { if (confirm('确定删除此反馈？')) { await api.delete(`/admin/feedback/${f.id}`); loadFeedbacks(); } }} className="text-xs text-red hover:underline">删除</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {replyingFeedback && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="w-96 glass rounded-xl p-5" style={{ background: 'var(--bg-secondary)' }}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-t1">回复反馈</h3>
                      <button onClick={() => setReplyingFeedback(null)} className="text-t3"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                    </div>
                    <textarea placeholder="输入回复内容..." value={replyContent} onChange={e => setReplyContent(e.target.value)} className="w-full h-24 glass rounded-lg px-3 py-2 text-sm text-t1 placeholder:text-t3 outline-none resize-none mb-4" />
                    <button onClick={async () => { if (!replyContent.trim()) return; await api.put(`/admin/feedback/${replyingFeedback}/reply`, { adminReply: replyContent }); setReplyingFeedback(null); loadFeedbacks(); }} className="w-full h-10 bg-accent rounded-lg text-sm font-medium" style={{ color: '#080808' }}>发送回复</button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
