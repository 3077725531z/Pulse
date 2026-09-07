import { useState, useEffect, useRef, useCallback } from 'react';
import { getSocket } from '../utils/socket';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import api from '../utils/api';

// 免费的公共 STUN 服务器，用于 NAT 穿透
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export default function CallModal({ callType, peerUserId, conversationId, peerName, peerAvatar, onEnd, incomingSignal }) {
  const user = useAuthStore(s => s.user);
  const [callState, setCallState] = useState('calling'); // calling | connected | ended
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const timerRef = useRef(null);
  const isInitiator = useRef(false);
  const durationRef = useRef(0);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  // 初始化 WebRTC
  const initWebRTC = useCallback(async () => {
    try {
      // 检查浏览器是否支持 WebRTC 和 getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const isSecure = window.isSecureContext;
        if (!isSecure) {
          setError('当前页面不是安全上下文(HTTPS)，无法使用音视频通话功能。请通过 HTTPS 访问。');
        } else {
          setError('当前浏览器不支持音视频通话，请使用 Chrome 或 Safari 浏览器');
        }
        return null;
      }

      // 获取本地媒体流（视频通话先尝试视频+音频，失败则降级纯音频）
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: callType === 'video',
        });
      } catch (mediaErr) {
        if (callType === 'video' && (mediaErr.name === 'NotFoundError' || mediaErr.name === 'NotReadableError')) {
          console.warn('Camera not found, falling back to audio only');
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        } else if (mediaErr.name === 'NotAllowedError') {
          setError('请允许访问摄像头/麦克风权限');
          return null;
        } else if (mediaErr.name === 'NotFoundError') {
          setError('未找到摄像头/麦克风设备');
          return null;
        } else {
          throw mediaErr;
        }
      }

      localStreamRef.current = stream;

      if (localVideoRef.current && callType === 'video') {
        localVideoRef.current.srcObject = stream;
      }

      // 检查 RTCPeerConnection 支持
      if (typeof RTCPeerConnection === 'undefined') {
        setError('当前浏览器不支持 WebRTC，请使用 Chrome 或 Safari 浏览器');
        return null;
      }

      // 创建 RTCPeerConnection
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;

      // 添加本地轨道
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // 处理远程流
      pc.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
        setCallState('connected');
      };

      // ICE 候选
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const socket = getSocket();
          socket?.emit('call:ice-candidate', { to: peerUserId, candidate: event.candidate });
        }
      };

      // 连接状态
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setCallState('connected');
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          handleEnd();
        }
      };

      return { pc, stream };
    } catch (err) {
      console.error('WebRTC init error:', err);
      if (err.name === 'NotAllowedError') {
        setError('请允许访问摄像头/麦克风权限');
      } else if (err.name === 'NotFoundError') {
        setError('未找到摄像头/麦克风设备');
      } else {
        setError('无法初始化通话: ' + err.message);
      }
      return null;
    }
  }, [callType, peerUserId]);

  // 发起通话（创建 Offer）或处理来电（创建 Answer）
  const startCall = useCallback(async () => {
    const socket = getSocket();
    if (!socket) {
      setError('连接已断开');
      return;
    }

    const result = await initWebRTC();
    if (!result) return;

    if (incomingSignal) {
      // 来电方：接收 offer，创建 answer
      isInitiator.current = false;
      const { pc } = result;
      await pc.setRemoteDescription(new RTCSessionDescription(incomingSignal));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('call:answer', { to: peerUserId, signal: answer });
    } else {
      // 发起方：创建 offer
      isInitiator.current = true;
      const { pc } = result;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('call:offer', {
        to: peerUserId,
        callType,
        signal: offer,
        conversationId,
      });
    }
  }, [initWebRTC, peerUserId, callType, conversationId, incomingSignal]);

  // 处理来电（创建 Answer）
  const handleIncomingOffer = useCallback(async (signal) => {
    const result = await initWebRTC();
    if (!result) return;

    isInitiator.current = false;
    const { pc } = result;

    await pc.setRemoteDescription(new RTCSessionDescription(signal));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    const socket = getSocket();
    socket?.emit('call:answer', { to: peerUserId, signal: answer });
  }, [initWebRTC, peerUserId]);

  // 结束通话
  const handleEnd = useCallback(() => {
    const socket = getSocket();
    if (socket) {
      if (durationRef.current > 0) {
        // 通话已连接，保存通话记录
        socket.emit('message:send', {
          conversationId,
          content: JSON.stringify({ duration: durationRef.current }),
          type: callType,
        });
      } else if (isInitiator.current) {
        // 发起方在对方接听前挂断，记录取消
        socket.emit('message:send', {
          conversationId,
          content: JSON.stringify({ action: 'cancel', callType }),
          type: 'system',
        });
      }
    }

    // 停止录制
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
      mediaRecorderRef.current = null;
    }

    // 停止本地流
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    // 关闭 RTCPeerConnection
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    // 停止计时器
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setCallState('ended');
    onEnd();
  }, [onEnd, conversationId, callType]);

  // 切换静音
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMuted(!audioTrack.enabled);
      }
    }
  };

  // 切换摄像头
  const toggleCamera = () => {
    if (localStreamRef.current && callType === 'video') {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCameraOff(!videoTrack.enabled);
      }
    }
  };

  // 格式化通话时长
  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // 格式化文件大小
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // 开始录制
  const startRecording = useCallback(() => {
    try {
      const streams = [];

      // 录制本地流
      if (localStreamRef.current) {
        streams.push(localStreamRef.current);
      }

      // 录制远程流
      const remoteStream = remoteVideoRef.current?.srcObject;
      if (remoteStream && remoteStream.getTracks().length > 0) {
        streams.push(remoteStream);
      }

      if (streams.length === 0) return;

      // 合并所有轨道到一个流
      const combinedStream = new MediaStream();
      streams.forEach(s => {
        s.getTracks().forEach(track => combinedStream.addTrack(track));
      });

      // 高清录制配置（优先 MP4，不支持则 WebM）
      let mimeType;
      if (callType === 'video') {
        if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,mp4a.40.2')) {
          mimeType = 'video/mp4;codecs=avc1,mp4a.40.2';
        } else if (MediaRecorder.isTypeSupported('video/mp4')) {
          mimeType = 'video/mp4';
        } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
          mimeType = 'video/webm;codecs=vp9,opus';
        } else {
          mimeType = 'video/webm;codecs=vp8,opus';
        }
      } else {
        if (MediaRecorder.isTypeSupported('audio/mp4;codecs=mp4a.40.2')) {
          mimeType = 'audio/mp4;codecs=mp4a.40.2';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else {
          mimeType = 'audio/webm;codecs=opus';
        }
      }

      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: callType === 'video' ? 4000000 : undefined, // 视频 4Mbps 高清
        audioBitsPerSecond: 128000, // 音频 128kbps
      });

      recordedChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const chunks = recordedChunksRef.current;
        if (chunks.length === 0) return;

        const blob = new Blob(chunks, { type: mimeType });
        if (blob.size < 1024) return; // 太小的文件不上传

        // 上传录制文件
        const formData = new FormData();
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const fileName = `${callType === 'video' ? '视频通话' : '语音通话'}_${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`;
        formData.append('recording', blob, fileName);
        formData.append('conversationId', conversationId);
        formData.append('callType', callType);
        formData.append('duration', durationRef.current.toString());

        try {
          await api.post('/chat/recordings/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            maxContentLength: 500 * 1024 * 1024,
            maxBodyLength: 500 * 1024 * 1024,
          });
          console.log('[Recording] Uploaded successfully, size:', formatFileSize(blob.size));
        } catch (err) {
          console.error('[Recording] Upload failed:', err);
        }
      };

      recorder.start(1000); // 每秒收集一次数据
      mediaRecorderRef.current = recorder;
      console.log('[Recording] Started, mimeType:', mimeType);
    } catch (err) {
      console.error('[Recording] Failed to start:', err);
    }
  }, [callType, conversationId]);

  // 停止录制
  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
      mediaRecorderRef.current = null;
      console.log('[Recording] Stopped');
    }
  }, []);

  // Socket 事件监听
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // 收到对方的 Answer
    const handleAnswer = async ({ from, signal }) => {
      if (from !== peerUserId) return;
      const pc = pcRef.current;
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
      }
    };

    // 收到 ICE 候选
    const handleIceCandidate = async ({ from, candidate }) => {
      if (from !== peerUserId) return;
      const pc = pcRef.current;
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Error adding ICE candidate:', err);
        }
      }
    };

    // 对方拒绝通话
    const handleReject = ({ from }) => {
      if (from !== peerUserId) return;
      setError('对方已拒绝通话');
      setTimeout(handleEnd, 1500);
    };

    // 对方结束通话
    const handleRemoteEnd = ({ from }) => {
      if (from !== peerUserId) return;
      handleEnd();
    };

    socket.on('call:answer', handleAnswer);
    socket.on('call:ice-candidate', handleIceCandidate);
    socket.on('call:reject', handleReject);
    socket.on('call:end', handleRemoteEnd);

    return () => {
      socket.off('call:answer', handleAnswer);
      socket.off('call:ice-candidate', handleIceCandidate);
      socket.off('call:reject', handleReject);
      socket.off('call:end', handleRemoteEnd);
    };
  }, [peerUserId, handleEnd]);

  // 发起通话 or 处理来电
  useEffect(() => {
    startCall();

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (pcRef.current) {
        pcRef.current.close();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // 通话计时 & 自动开始录制
  useEffect(() => {
    if (callState === 'connected' && !timerRef.current) {
      timerRef.current = setInterval(() => {
        setDuration(prev => {
          durationRef.current = prev + 1;
          return prev + 1;
        });
      }, 1000);
      // 自动开始录制
      setTimeout(() => startRecording(), 500);
    }
  }, [callState, startRecording]);

  const GRADIENTS = [
    'linear-gradient(135deg,#38bdf8,#0ea5e9)',
    'linear-gradient(135deg,#fbbf24,#f59e0b)',
    'linear-gradient(135deg,#a78bfa,#7c3aed)',
    'linear-gradient(135deg,#f472b6,#ec4899)',
    'linear-gradient(135deg,#22d3ee,#06b6d4)',
    'linear-gradient(135deg,#c084fc,#a855f7)',
    'linear-gradient(135deg,#fb923c,#f97316)',
  ];

  const getGradient = (name) => {
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
  };

  return (
    <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col z-50">
      {/* 视频区域 */}
      {callType === 'video' ? (
        <div className="flex-1 relative">
          {/* 远程视频 */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          {/* 本地视频（小窗） */}
          <div className="absolute top-4 right-4 w-28 h-40 rounded-xl overflow-hidden border-2 border-white/20 shadow-lg">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover mirror"
              style={{ transform: 'scaleX(-1)' }}
            />
          </div>
          {/* 等待连接中覆盖层 */}
          {callState !== 'connected' && !error && (
            <div className="absolute inset-0 bg-[#0a0a0a] flex flex-col items-center justify-center">
              <div className="w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold text-white mb-4"
                style={{ background: getGradient(peerName) }}
              >
                {peerAvatar ? (
                  <img src={peerAvatar} alt="" className="w-full h-full object-cover rounded-full" />
                ) : (
                  (peerName || '?')[0]
                )}
              </div>
              <p className="text-white text-xl font-semibold">{peerName}</p>
              <p className="text-white/60 text-sm mt-2">
                {error || (callState === 'calling' ? '正在等待对方接听...' : '连接中...')}
              </p>
              <div className="mt-4">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* 语音通话界面 */
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-28 h-28 rounded-full flex items-center justify-center text-5xl font-bold text-white mb-6"
            style={{ background: getGradient(peerName) }}
          >
            {peerAvatar ? (
              <img src={peerAvatar} alt="" className="w-full h-full object-cover rounded-full" />
            ) : (
              (peerName || '?')[0]
            )}
          </div>
          <p className="text-white text-2xl font-semibold">{peerName}</p>
          <p className="text-white/60 text-sm mt-2">
            {error || (callState === 'calling' ? '正在呼叫...' : callState === 'connected' ? formatDuration(duration) : '连接中...')}
          </p>
          {callState === 'calling' && !error && (
            <div className="flex gap-1 mt-4">
              <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          )}
          {/* 语音通话时也播放远程音频 */}
          <audio ref={remoteVideoRef} autoPlay playsInline className="hidden" />
        </div>
      )}

      {/* 通话时长（已连接后显示） */}
      {callState === 'connected' && callType === 'video' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 px-4 py-1.5 rounded-full">
          <span className="text-white text-sm">{formatDuration(duration)}</span>
        </div>
      )}

      {/* 底部控制栏 */}
      <div className="shrink-0 pb-10 pt-6 flex items-center justify-center gap-6">
        {/* 静音按钮 */}
        <button
          onClick={toggleMute}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${muted ? 'bg-white/30' : 'bg-white/15'}`}
        >
          {muted ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .5-.05.99-.14 1.46" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
        </button>

        {/* 结束通话按钮 */}
        <button
          onClick={handleEnd}
          className="w-16 h-16 bg-red rounded-full flex items-center justify-center shadow-lg"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 0 1-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71s-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.73-1.68-1.36-2.66-1.85a.994.994 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" fill="#080808"/>
          </svg>
        </button>

        {/* 摄像头切换（仅视频通话） */}
        {callType === 'video' && (
          <button
            onClick={toggleCamera}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${cameraOff ? 'bg-white/30' : 'bg-white/15'}`}
          >
            {cameraOff ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34m-7.72-2.06a4 4 0 1 1-5.56-5.56" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M23 7l-7 5 7 5V7z" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            )}
          </button>
        )}

        {/* 切换摄像头（仅视频通话） */}
        {callType === 'video' && (
          <button
            onClick={() => {
              if (localStreamRef.current) {
                const videoTrack = localStreamRef.current.getVideoTracks()[0];
                if (videoTrack) {
                  // 获取当前摄像头 facingMode
                  const settings = videoTrack.getSettings();
                  const newFacingMode = settings.facingMode === 'user' ? 'environment' : 'user';
                  // 重新获取媒体流
                  navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: { facingMode: newFacingMode }
                  }).then(newStream => {
                    const newVideoTrack = newStream.getVideoTracks()[0];
                    const sender = pcRef.current?.getSenders().find(s => s.track?.kind === 'video');
                    if (sender) {
                      sender.replaceTrack(newVideoTrack);
                    }
                    // 替换本地流中的视频轨道
                    localStreamRef.current.removeTrack(videoTrack);
                    localStreamRef.current.addTrack(newVideoTrack);
                    videoTrack.stop();
                    if (localVideoRef.current) {
                      localVideoRef.current.srcObject = localStreamRef.current;
                    }
                  });
                }
              }
            }}
            className="w-14 h-14 bg-white/15 rounded-full flex items-center justify-center"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
