<template>
  <div class="container">
    <!-- 顶栏 -->
    <div class="header">
      <div class="header-scroll-container"></div>
      <div class="avatar-circle exit-btn" @click="logout">⎋</div>
      <div class="avatar-circle add-btn" @click="toggleAddFriend">＋</div>
      
      <!-- 好友列表 -->
      <!-- 修改头像模板 -->
      <div 
          v-for="friend in store.friends"
          :key="friend._id"
          class="avatar-circle"
          :data-username="friend.username"
          :class="{ 
              online: friend.isOnline,
              active: store.currentChat === friend._id
          }" 
          @click="selectFriend(friend._id)"
      >
          {{ friend.username[0].toUpperCase() }}
          <!-- 在线状态指示器 -->
          <div class="status-dot"></div>
      </div>
    </div>


      <!-- 添加好友弹窗 -->
      <div v-if="showAddFriendModal" class="modal-mask">
      <div class="modal">
          <input 
          v-model="newFriendName" 
          placeholder="  输入用户名"
          class="modal-input"
          >
          <div class="modal-actions">
          <button class="modal-btn confirm-btn" @click="addFriend">添加</button>
          <button class="modal-btn cancel-btn" @click="toggleAddFriend">取消</button>
          </div>
      </div>
      </div>

    <!-- 聊天区域 -->
    <div class="chat-area" ref="chatArea">
    <div 
      v-for="msg in store.messages"
      :key="msg._id"
      :class="['message-container', { 'own-message': msg.from === userId }]"
    >
      <div class="message-time">{{ formatTime(msg.timestamp) }}</div>
      <div class="message-bubble">
        <!-- 文本消息 -->
        <div class="message-content" v-if="msg.type === 'text'">
          {{ msg.content }}
        </div>
        
        <!-- 图片消息 - 修复图片URL -->
        <div v-else-if="msg.type === 'image'">
          <img 
            :src="getFullUrl(msg.content)" 
            alt="图片消息"
            style="max-width: 300px; max-height: 300px; border-radius: 8px;"
          />
          <div v-if="!msg.content">图片加载失败</div>
        </div>
        
        <!-- 语音消息 - 修复播放器 -->
        <div v-else-if="msg.type === 'audio'" class="audio-message">
          <audio controls class="audio-player">
            <source :src="getFullUrl(msg.content)" type="audio/webm">
            您的浏览器不支持音频播放
          </audio>
          <div v-if="!msg.content">音频加载失败</div>
        </div>
      </div>
    </div>
  </div>
  <!-- ...其他代码... -->

      <!-- 底栏 - 添加多媒体按钮 -->
  <div class="footer">
    <!-- 语音录制按钮 -->
    <button 
      class="record-btn"
      @mousedown="startRecording"
      @mouseup="stopRecording"
      @touchstart="startRecording"
      @touchend="stopRecording"
    >
      🎤
    </button>
    
    <!-- 图片选择按钮 -->
    <label for="image-upload" class="upload-btn">
      📷
      <input
        id="image-upload"
        type="file"
        accept="image/*"
        @change="handleImageUpload"
        hidden
      >
    </label>
    
    <!-- 消息输入框 -->
    <input
      v-model="newMessage"
      @keyup.enter="sendTextMessage"
      :placeholder="currentPlaceholder"
    >
    
    <!-- 发送按钮 -->
    <button @click="sendTextMessage">发送</button>
  </div>
  
  </div>
    <!-- ...其他代码... -->
    <RecordingIndicator 
    :isVisible="isRecording"
    :duration="recordingDuration"
    @stop="stopRecording"
  />
</template>

<script setup>
import { ref, onMounted, nextTick, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '@/store/chatStore'
import axios from 'axios'
import RecordingIndicator from './RecordingIndicator.vue'


const router = useRouter()
const store = useChatStore()
const newMessage = ref('')
const userId = localStorage.getItem('userId')
const chatArea = ref(null)
const showAddFriendModal = ref(false)
const newFriendName = ref('')
// 新增状态
const isRecording = ref(false);
const mediaRecorder = ref(null);
const audioChunks = ref([]);
const recordingTimer = ref(null);
const recordingDuration = ref(0);

// 新增方法 - 处理图片上传
const handleImageUpload = async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await axios.post(`${getBaseURL()}/api/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    
    if (response.data.url) {
      sendMediaMessage(response.data.url, 'image');
    }
  } catch (error) {
    console.error('图片上传失败:', error);
    alert('图片上传失败');
  } finally {
    // 重置input允许重复选择相同文件
    event.target.value = '';
  }
};

// 新增方法 - 开始录音
const startRecording = () => {
  if (isRecording.value) return;
  
  if (!navigator.mediaDevices) {
    alert('您的浏览器不支持录音功能');
    return;
  }
  
  audioChunks.value = [];
  recordingDuration.value = 0;
  
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      isRecording.value = true;
      mediaRecorder.value = new MediaRecorder(stream);
      
      mediaRecorder.value.ondataavailable = event => {
        audioChunks.value.push(event.data);
      };
      
      mediaRecorder.value.onstop = async () => {
        const audioBlob = new Blob(audioChunks.value, { type: 'audio/webm' });
        await uploadAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.value.start();
      
      // 设置录音计时器
      recordingTimer.value = setInterval(() => {
        recordingDuration.value++;
        // 最长录制60秒
        if (recordingDuration.value >= 60) {
          stopRecording();
        }
      }, 1000);
    })
    .catch(error => {
      console.error('获取麦克风权限失败:', error);
      alert('无法访问麦克风，请检查权限设置');
    });
};

// 新增方法 - 停止录音
const stopRecording = () => {
  if (!isRecording.value) return;
  
  isRecording.value = false;
  clearInterval(recordingTimer.value);
  
  if (mediaRecorder.value && mediaRecorder.value.state !== 'inactive') {
    mediaRecorder.value.stop();
  }
};

// 1. 修复语音录制和上传
const uploadAudio = async (audioBlob) => {
  try {
    const formData = new FormData();
    formData.append('file', audioBlob, `recording-${Date.now()}.webm`);
    
    const response = await axios.post(`${getBaseURL()}/api/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    
    if (response.data.url) {
      // 确保使用完整URL
      const fullUrl = response.data.url.startsWith('http') 
        ? response.data.url 
        : `${getBaseURL()}${response.data.url}`;
      
      sendMediaMessage(fullUrl, 'audio');
    }
  } catch (error) {
    console.error('音频上传失败:', error);
    alert('音频上传失败: ' + (error.response?.data?.error || error.message));
  }
};

// 2. 修复消息发送
const sendMediaMessage = (url, mediaType) => {
  if (!store.currentChat) return;
  
  const msg = {
    type: mediaType,
    from: userId,
    to: store.currentChat,
    content: url,
    timestamp: new Date().toISOString()
  };
  
  if (store.ws && store.ws.readyState === WebSocket.OPEN) {
    store.ws.send(JSON.stringify(msg));
    
    // 修复: 立即添加到本地消息列表
    store.messages.push({
      ...msg,
      _id: `temp-${Date.now()}`,
      timestamp: new Date(msg.timestamp)
    });
  } else {
    console.error('WebSocket连接未就绪');
    alert('发送失败，请检查网络连接');
  }
};
// 3. 添加辅助函数获取完整URL
const getFullUrl = (path) => {
  if (!path) return '';
  // 如果已经是完整URL，直接返回
  if (path.startsWith('http')) return path;
  // 否则拼接基础URL
  return `${getBaseURL()}${path}`;
};
// WebSocket 连接管理
let reconnectAttempts = 0
const MAX_RECONNECT_ATTEMPTS = 5

const getBaseURL = () => {
  return window.location.hostname.includes('085410.xyz') 
    ? 'https://web-production-5fc08.up.railway.app'
    : 'http://localhost:3000'
}

const getWsURL = () => {
  return window.location.hostname.includes('085410.xyz') 
    ? 'wss://web-production-5fc08.up.railway.app'
    : 'ws://localhost:3000'
}

// WebSocket 连接管理（优化重连逻辑）
const connectWebSocket = () => {
const ws = new WebSocket(getWsURL())
let heartbeatInterval

const sendConnect = () => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'connect',
      userId: localStorage.getItem('userId')
    }))
  }
}

ws.onopen = () => {
  console.log('WebSocket连接成功')
  reconnectAttempts = 0
  sendConnect()
  
  // 心跳机制（每25秒发送一次）
  heartbeatInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }))
    }
  }, 25000)
}

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data)
      switch (message.type) {
        case 'message':
          store.messages.push(message)
          break
        case 'status':
          const friend = store.friends.find(f => f._id === message.userId)
          if (friend) friend.isOnline = message.online
          break
        case 'system':
          console.log('系统消息:', message.message)
          break
      }
    } catch (error) {
      console.error('消息解析错误:', error)
    }
  }

// 新增：在收到关闭事件时尝试立即重连
ws.onclose = (event) => {
  console.log('连接关闭，代码:', event.code, '原因:', event.reason)
  clearInterval(heartbeatInterval)
  
  // 立即尝试重连（指数退避）
  const reconnect = () => {
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      console.log(`尝试第 ${reconnectAttempts + 1} 次重连...`)
      store.ws = connectWebSocket()
      reconnectAttempts++
    }
  }
  
  // 首次立即重连，后续使用延迟
  if (reconnectAttempts === 0) {
    reconnect()
  } else {
    const delay = Math.min(3000 * Math.pow(2, reconnectAttempts), 30000)
    setTimeout(reconnect, delay)
  }
}

  ws.onerror = (error) => {
    console.error('WebSocket错误:', error)
  }

  return ws
}

// 退出登录
const logout = () => {
  localStorage.removeItem('userId')
  localStorage.removeItem('username')
  router.push('/login')
}

// 添加好友功能
const toggleAddFriend = () => {
  showAddFriendModal.value = !showAddFriendModal.value
  newFriendName.value = ''
}

const currentFriend = computed(() => {
  return store.friends.find(f => f._id === store.currentChat)
})

const currentPlaceholder = computed(() => {
  if (!store.currentChat) return '点击顶栏头像进行聊天吧！'
  return currentFriend.value
    ? `给 ${currentFriend.value.username} 发送消息`
    : '正在加载用户信息...'
})

// 优化后的添加好友方法
const addFriend = async () => {
try {
  if (!newFriendName.value.trim()) {
    alert('请输入好友用户名');
    return;
  }

  const response = await axios.post(`${getBaseURL()}/api/friends`, {
    userId: localStorage.getItem('userId'),
    friendUsername: newFriendName.value.trim()
  });

  if (response.data?.friendId) {
    // 调用新添加的获取用户信息接口
    const friendInfo = await axios.get(`${getBaseURL()}/api/user/${response.data.friendId}`)
    
    store.friends.push({
      _id: response.data.friendId,
      username: friendInfo.data.username,
      isOnline: false // 此处可以结合WebSocket状态更新
    });
    
    toggleAddFriend();
    alert('添加成功！');
  }
} catch (error) {
  let errorMessage = '添加失败，请重试';
  if (error.response) {
    switch (error.response.data.code) {
      case 'FRIEND_NOT_FOUND':
        errorMessage = '用户不存在';
        break;
      case 'ALREADY_FRIENDS':
        errorMessage = '已是好友关系';
        break;
      case 'SELF_ADDITION':
        errorMessage = '不能添加自己';
        break;
    }
  }
  alert(`错误: ${errorMessage}`);
  console.error('添加好友失败详情:', error.response?.data || error.message);
}
}

// 选择好友
const selectFriend = async (friendId) => {
  store.currentChat = friendId
  await store.loadMessages()
}

// 修改方法 - 重命名文本消息发送
const sendTextMessage = () => {
  if (!newMessage.value.trim()) return;
  
  sendMediaMessage(newMessage.value.trim(), 'text');
  newMessage.value = '';
};


// 时间格式化
const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// 消息渲染修改
watch(() => store.messages, async () => {
  await nextTick();
  if (chatArea.value) {
    chatArea.value.scrollTop = chatArea.value.scrollHeight;
  }
}, { deep: true });

// 初始化加载
onMounted(async () => {
  try {
    // 加载好友列表
    const friendsRes = await axios.get(`${getBaseURL()}/api/friends`, {
      params: { userId }
    })
    store.friends = friendsRes.data.friends.map(f => ({
      ...f,
      isOnline: false // 初始状态设为离线
    }))

    // 建立WebSocket连接
    store.ws = connectWebSocket()
  } catch (error) {
    console.error('初始化失败:', error)
    alert('初始化失败，请刷新页面重试')
  }
})
</script>

<!-- 样式保持不变 -->
<style scoped>
/* 添加状态指示样式 */
.avatar-circle {
position: relative;
overflow: visible;
}

.status-dot {
position: absolute;
bottom: 2px;
right: 2px;
width: 12px;
height: 12px;
border-radius: 50%;
background: #ccc; /* 默认离线状态 */
border: 2px solid white;
transition: all 0.3s ease;
}

.online .status-dot {
background: #4CAF50; /* 在线状态颜色 */
box-shadow: 0 0 8px rgba(76, 175, 80, 0.3);
}

/* 移动端优化 */
@media (max-width: 480px) {
.status-dot {
  width: 10px;
  height: 10px;
  bottom: 1px;
  right: 1px;
}
}
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(255,255,255,0.6);
  backdrop-filter: blur(5px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 999;
}

.modal {
  background: #fff;
  border-radius: 30px;
  padding: 28px;
  width: 78%;
  max-width: 320px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.12);
}

.modal-input {
  width: 100%;
  height: 52px;
  padding: 0 0px;
  border: 2px solid #f0f0f0;
  border-radius: 30px;
  font-size: 16px;
  margin-bottom: 24px;
  background: #fff;
  transition: all 0.2s;
}

.modal-input:focus {
  border-color: orange;
  outline: none;
  box-shadow: 0 0 0 3px rgba(0,122,255,0.1);
}

.modal-actions {
  display: flex;
  gap: 12px;
}

.modal-btn {
  flex: 1;
  height: 52px;
  border: none;
  border-radius: 30px;
  font-size: 17px;
  font-weight: 500;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.confirm-btn {
  background: orange;
  color: white;
  margin-left: -6px; /* 视觉对齐补偿 */
}

.confirm-btn:active {
  background: #0062cc;
  transform: scale(0.96);
}

.cancel-btn {
  background: transparent;
  color: #666;
  border: 2px solid #e3e3e3;
  margin-right: -6px; /* 视觉对齐补偿 */
}

.cancel-btn:active {
  background: #f8f8f8;
  transform: scale(0.96);
}

/* 输入框占位符样式 */
.modal-input::placeholder {
  color: #999;
  font-weight: 300;
}

/* 全局样式重置 */

/* 颜色主题 */
:root {
--primary: #FF6B35;      /* 主橘色 */
--primary-dark: #E85720; /* 深橘色 */
--bg: #FFFFFF;           /* 背景白 */
--text-primary: #2D3748; /* 主要文字 */
--text-secondary: #718096; /* 次要文字 */
--border: #E2E8F0;       /* 边框色 */
}

/* 容器布局 */
.container {
height: 100vh;
display: flex;
flex-direction: column;
background: var(--bg);
overflow: hidden;
}

/* 顶栏 */
.header {
position: fixed;
overflow-x: auto;
-webkit-overflow-scrolling: touch;
cursor: grab;
scrollbar-width: none;
left: 0;
right: 0;
top: 0;
width: 100%;
height: 64px;
background: orange;
display: flex;
align-items: center;
padding: 0 0px;
gap: 12px;
z-index: 1000;
box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
.header-scroll-container{
  display: inline-flex;
  height: 100%;
  align-items: center;
  padding: 0 0.5%;
  gap: 3%;
  flex-shrink: 0;
}

/* 聊天区域 */
.chat-area {
flex: 1;
background-color: rgb(255, 246, 234);
overflow-y: auto;
padding: 80px 16px 100px;
display: flex;
flex-direction: column;
}

/* 消息容器 */
.message-container {
position: relative;
max-width: 85%;
margin: 14px 0px;
align-self: flex-start; /* 默认接收消息在左边 */
}

.message-container.own-message {
align-self: flex-end; /* 发送消息在右边 */
margin-right: 0px;
}

/* 时间显示 */
/* 消息时间样式调整 */
.message-time {
position: absolute;
top: -18px;
font-size: 0.7rem;
color: var(--text-secondary);
white-space: nowrap;
/* 默认接收方样式 */
left: 8px;
}
.message-container.own-message .message-time {
/* 发送方调整为右对齐 */
left: auto;
right: 8px;
text-align: right;
}

/* 消息气泡 */
.message-bubble {
padding: 12px 16px;
border-radius: 30px;
background: #F7FAFC;
position: relative;
word-break: break-word;
line-height: 1.4;
box-shadow: 0 2px 4px rgba(0,0,0,0.05);
max-width: 480px; /* 最大宽度限制 */
}

.message-container.own-message .message-bubble {
background: orange;
color: white !important;
border-radius: 20px 4px 20px 20px;
box-shadow: 0 2px 6px rgba(0,0,0,0.1);
}

/* 底栏 */
.footer {
position: fixed;
left: 0;
right: 0;
bottom: 0;
width: 100%;
height: 64px;
background: gainsboro;
display: flex;
gap: 18px;
align-items: center;
padding: 0 0;
border-top: 1px solid var(--border);
}

/* 输入框 */
.footer input {
flex: 1;
height: 48px;
border: 2px solid var(--border);
border-radius: 28px;
padding: 0 20px;
font-size: 16px;
background: white;
transition: all 0.2s;
margin-left: 4.5%;
}

.footer input:focus {
border-color: var(--primary);
box-shadow: 0 0 0 3px rgba(255,107,53,0.1);
outline: none;
}

/* 发送按钮 */
.footer button {
width: 96px;
height: 48px;
background: orange;
color: black;
border: none;
border-radius: 26px;
font-weight: 600;
cursor: pointer;
transition: all 0.2s;
margin-right: 4.5%;
}

.footer button:hover {
background: var(--primary-dark);
}

/* 新增多媒体按钮样式 */
.footer {
  display: flex;
  align-items: center;
  gap: 12px;
}

.record-btn, .upload-btn {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: white;
  border: 1px solid #ddd;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  cursor: pointer;
  transition: all 0.2s;
}

.record-btn:active, .upload-btn:active {
  transform: scale(0.95);
}

.record-btn.recording {
  background: #ff4d4f;
  color: white;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

/* 消息气泡样式修改 */
.message-container.own-message .message-bubble {
  max-width: 80%;
}

.message-content img {
  max-width: 100%;
  border-radius: 12px;
  margin-top: 8px;
}

.audio-message {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  background: #f0f7ff;
  border-radius: 20px;
}

.audio-player {
  width: 100%;
  margin-top: 8px;
}

/* 录音指示器 */
.recording-indicator {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0,0,0,0.7);
  color: white;
  padding: 20px;
  border-radius: 10px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.recording-dot {
  width: 20px;
  height: 20px;
  background: red;
  border-radius: 50%;
  margin-bottom: 10px;
  animation: blink 1s infinite;
}
/* 修复消息布局 */
.message-container {
  max-width: 80%;
  margin-bottom: 24px;
}

.message-bubble {
  padding: 12px 16px;
  border-radius: 30px;
  background: #f0f0f0;
}

.own-message .message-bubble {
  background: #4e8cff;
  color: white;
}

/* 图片消息样式 */
img {
  max-width: 90%;
  border-radius: 8px;
  margin-top: 8px;
  border: 0px solid #eee;
}

/* 音频播放器样式 */
.audio-message {
  padding: 12px;
  background: #f8f8f8;
  border-radius: 24px;
}

.audio-player {
  width: 100%;
  height: 40px;
}

/* 录音按钮样式 */
.record-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  cursor: pointer;
  border: 1px solid #ddd;
}

.record-btn.recording {
  background: #ff4d4f;
  color: white;
  animation: pulse 1s infinite;
}
@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

/* 头像基础样式 */
.avatar-circle {
flex-shrink: 0;
width: 44px;
height: 44px;
border-radius: 50%;
display: flex;
align-items: center;
justify-content: center;
font-weight: 600;
color: var(--primary);
box-shadow: 0 2px 4px rgba(0,0,0,0.1);
transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
position: relative;
z-index: 1;
border: 2px solid transparent;
}

/* 选中状态 */
.avatar-circle.active {
  position: relative;
transform: scale(0.8);
}

.avatar-circle.active::after {
content: "";
position: absolute;
top: -6px;
left: -6px;
right: -6px;
bottom: -6px;
border: 8px solid orange;
border-radius: 50%;
/* box-shadow: 
  0 0 0 2px white,
  0 0 12px rgba(255, 167, 38, 0.5); */
animation: pulse 2.5s infinite;
z-index: -1;
}

@keyframes pulse {
0% { transform: scale(0.9); opacity: 1; }
50% { transform: scale(1.55); opacity: 1; }
100% { transform: scale(0.9); opacity: 1; }
}

/* 随机背景色保持最底层 */
/* 将原有4种扩展到7种 */
.avatar-circle:nth-child(7n+1) { background-color: #fff3e0; } /* 浅橙色 */
.avatar-circle:nth-child(7n+2) { background-color: #f5f6fa; } /* 浅蓝色 */
.avatar-circle:nth-child(7n+3) { background-color: #e8f5e9; } /* 浅绿色 */
.avatar-circle:nth-child(7n+4) { background-color: #f3e5f5; } /* 浅紫色 */
.avatar-circle:nth-child(7n+6) { background-color: #ffeef7; } /* 新增浅粉色 */
.avatar-circle:nth-child(7n+5) { background-color: #feeb8c; } /* 新增浅米色 */
.avatar-circle:nth-child(7n+7) { background-color: #e0f4f3; } /* 新增浅青绿 */


</style>