<template>
  <div class="container">
    <!-- 顶栏 -->
    <div class="header">
      <div class="header-scroll-container"></div>
      <div class="avatar-circle exit-btn" @click="logout">⎋</div>
      <div class="avatar-circle add-btn" @click="toggleAddFriend">＋</div>
      
      <!-- 好友列表 -->
      <!-- 修改头像模板 -->
      <template v-if="store.friends">
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
      </template>
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
    // 修改消息显示区域
<div class="chat-area" ref="chatArea">
  <div 
    v-for="msg in store.messages"
    :key="msg._id || msg.timestamp"
    :class="['message-container', { 'own-message': msg.from === userId }]"
  >
    <div class="message-time">{{ formatTime(msg.timestamp) }}</div>
    
    <!-- 文本消息 -->
    <div v-if="msg.type === 'text'" class="message-bubble">
      <div class="message-content">{{ msg.content }}</div>
    </div>
    
    <!-- 图片消息 -->
    <div v-else-if="msg.type === 'image'" class="message-image">
      <img 
        :src="msg.fileUrl" 
        alt="图片消息"
        @click="openLightbox(msg.fileUrl)"
      >
      <div v-if="msg.content" class="image-caption">{{ msg.content }}</div>
    </div>
    
    <!-- 语音消息 -->
    <div v-else-if="msg.type === 'audio'" class="message-audio">
      <audio controls :src="msg.fileUrl"></audio>
      <div class="audio-transcript" v-if="msg.content">
        {{ msg.content }}
      </div>
      <div class="audio-duration">{{ msg.duration.toFixed(1) }}秒</div>
    </div>
  </div>
</div>

    <!-- 底栏 -->
   <!-- 修改底栏区域 -->
  <div class="footer">
    <!-- 图片上传按钮 -->
    <label for="image-upload" class="footer-icon">
      📷
      <input 
        id="image-upload" 
        type="file" 
        accept="image/*" 
        @change="handleImageUpload"
        style="display: none;"
      >
    </label>
    
    <!-- 语音录制按钮 -->
    <button 
      class="footer-icon"
      @mousedown="startRecording"
      @mouseup="stopRecording"
      @touchstart="startRecording"
      @touchend="stopRecording"
      :class="{ recording: isRecording }"
    >
      🎤
    </button>
    
    <!-- 消息输入框 -->
    <input
      v-model="newMessage"
      @keyup.enter="sendTextMessage"
      :placeholder="currentPlaceholder"
    >
    
    <!-- 发送按钮 -->
    <button @click="sendTextMessage">发送</button>
    
    <!-- 音频播放器（临时显示） -->
    <audio 
      v-if="audioPreviewUrl" 
      :src="audioPreviewUrl" 
      controls
      class="audio-preview"
    ></audio>
  </div>
  
  <!-- 录音指示器 -->
  <div v-if="isRecording" class="recording-indicator">
    <div class="pulse"></div>
    <div>正在录音... {{ recordingDuration }}秒</div>
  </div>
  </div>
</template>


<script setup>
import { ref, onMounted, nextTick, watch, computed, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '@/store/chatStore'
import axios from 'axios'
// 添加新的导入

// 添加新变量
const isRecording = ref(false);
const mediaRecorder = ref(null);
const audioChunks = ref([]);
const audioPreviewUrl = ref('');
const recordingDuration = ref(0);
let recordingTimer = null;

const router = useRouter()
const store = useChatStore()
const newMessage = ref('')
const userId = localStorage.getItem('userId')
const chatArea = ref(null)
const showAddFriendModal = ref(false)
const newFriendName = ref('')
const sendButton = ref('发送')
const socket = ref(null)


console.log('Store:', store);
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

// 修复 WebSocket 连接
const connectWebSocket = () => {
  const ws = new WebSocket(getWsURL())
  let heartbeatInterval

  ws.onopen = () => {
    console.log('WebSocket连接成功')
    ws.send(JSON.stringify({
      type: 'connect',
      userId: localStorage.getItem('userId')
    }))
    
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

  ws.onclose = (event) => {
    console.log('连接关闭，代码:', event.code, '原因:', event.reason)
    clearInterval(heartbeatInterval)
  }

  ws.onerror = (error) => {
    console.error('WebSocket错误:', error)
  }

  socket.value = ws
  return ws
}

// 退出登录
const logout = () => {
  localStorage.removeItem('userId')
  localStorage.removeItem('username')
  router.push('/login')
}

// 添加方法
const sendTextMessage = () => {
  if (newMessage.value.trim()) {
    store.sendMessage(newMessage.value.trim());
    newMessage.value = '';
  }
};

const handleImageUpload = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  try {
    sendButton.value = '上传中...';
    
    const uploadResult = await store.uploadFile(file);
    store.sendMessage('图片消息', 'image', uploadResult);
    
    // 重置输入
    e.target.value = '';
  } catch (error) {
    alert('图片上传失败: ' + error.message);
  } finally {
    sendButton.value = '发送';
  }
};



const startRecording = async () => {
  if (isRecording.value) return;
  
  try {
    audioChunks.value = [];
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder.value = new MediaRecorder(stream);
    
    mediaRecorder.value.ondataavailable = (e) => {
      if (e.data.size > 0) {
        audioChunks.value.push(e.data);
      }
    };
    
    mediaRecorder.value.onstop = async () => {
      const audioBlob = new Blob(audioChunks.value, { type: 'audio/webm' });
      
      // 创建预览URL
      audioPreviewUrl.value = URL.createObjectURL(audioBlob);
      
      // 计算时长
      const duration = recordingDuration.value;
      recordingDuration.value = 0;
      
      try {
        // 创建文件对象
        const audioFile = new File([audioBlob], 'recording.webm', {
          type: 'audio/webm'
        });
        
        // 上传文件
        const uploadResult = await store.uploadFile(audioFile, duration);
        
        // 发送语音消息
        store.sendMessage(uploadResult.transcript, 'audio', {
          ...uploadResult,
          duration
        });
        
        // 5秒后清除预览
        setTimeout(() => {
          audioPreviewUrl.value = '';
          URL.revokeObjectURL(audioPreviewUrl.value);
        }, 5000);
      } catch (error) {
        alert('语音消息发送失败: ' + error.message);
      }
      
      // 关闭媒体流
      stream.getTracks().forEach(track => track.stop());
    };
    
    mediaRecorder.value.start();
    isRecording.value = true;
    
    // 开始计时
    recordingDuration.value = 0;
    recordingTimer = setInterval(() => {
      recordingDuration.value = parseFloat((recordingDuration.value + 0.1).toFixed(1));
    }, 100);
  } catch (error) {
    console.error('录音启动失败:', error);
    alert('无法访问麦克风，请检查权限设置');
    isRecording.value = false;
  }
};

const stopRecording = () => {
  if (isRecording.value && mediaRecorder.value) {
    mediaRecorder.value.stop();
    isRecording.value = false;
    clearInterval(recordingTimer);
  }
};

// 添加图片预览方法
const openLightbox = (imageUrl) => {
  // 实现一个简单的lightbox功能
  // 可以使用第三方库或自定义模态框
};

// 清理资源
onUnmounted(() => {
  stopRecording();
  if (audioPreviewUrl.value) {
    URL.revokeObjectURL(audioPreviewUrl.value);
  }
});

// 添加好友功能
const toggleAddFriend = () => {
  showAddFriendModal.value = !showAddFriendModal.value
  newFriendName.value = ''
}

const currentFriend = computed(() => {
  return store.friends.find(f => f._id === store.currentChat)
})

const currentPlaceholder = computed(() => {
  if (!store) return '加载中...' // 安全检查
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

// 发送消息
const sendMessage = () => {
  if (!newMessage.value.trim()) return

  const ws = socket.value || store.ws
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.log('连接未就绪，尝试重新发送...')
    store.ws = connectWebSocket()
    setTimeout(sendMessage, 500)
    return
  }

  try {
    const message = {
      type: 'message',
      from: userId,
      to: store.currentChat,
      content: newMessage.value.trim(),
      timestamp: new Date().toISOString()
    }
    
    ws.send(JSON.stringify(message))
    newMessage.value = ''
  } catch (error) {
    console.error('发送消息失败:', error)
    alert('消息发送失败，请检查网络连接')
  }
}


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

// 消息自动滚动
watch(() => store.messages, async () => {
  await nextTick()
  if (chatArea.value) {
    chatArea.value.scrollTop = chatArea.value.scrollHeight
  }
}, { deep: true })

// 初始化加载
onMounted(async () => {
  try {
    // 确保使用 store 的方法
    await store.loadFriends()
    
    // 设置初始好友列表
    if (!store.friends) store.friends = []
    
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
max-width: 80%;
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

/* 添加新样式 */
.footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 64px;
  background: gainsboro;
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 0 10px;
  border-top: 1px solid var(--border);
}

.footer-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  transition: all 0.2s;
}

.footer-icon:hover {
  background: #f0f0f0;
  transform: scale(1.05);
}

.footer-icon.recording {
  background: #ff4d4d;
  color: white;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(255, 77, 77, 0.7); }
  70% { box-shadow: 0 0 0 10px rgba(255, 77, 77, 0); }
  100% { box-shadow: 0 0 0 0 rgba(255, 77, 77, 0); }
}

.recording-indicator {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 20px;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 1000;
}

.pulse {
  width: 80px;
  height: 80px;
  background: #ff4d4d;
  border-radius: 50%;
  margin-bottom: 15px;
  animation: pulse 2s infinite;
}

/* 消息样式 */
.message-image img {
  max-width: 300px;
  max-height: 300px;
  border-radius: 15px;
  cursor: zoom-in;
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}

.message-image .image-caption {
  margin-top: 5px;
  font-size: 0.9em;
  color: #666;
}

.message-audio {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.message-audio audio {
  max-width: 250px;
}

.audio-transcript {
  margin-top: 5px;
  padding: 8px;
  background: #f8f8f8;
  border-radius: 8px;
  font-size: 0.85em;
  max-width: 300px;
}

.audio-duration {
  font-size: 0.8em;
  color: #777;
  margin-top: 4px;
}

.own-message .message-audio {
  align-items: flex-end;
}

.audio-preview {
  position: absolute;
  bottom: 70px;
  width: 250px;
  right: 10px;
  background: white;
  border-radius: 20px;
  padding: 5px;
  box-shadow: 0 4px 10px rgba(0,0,0,0.1);
}

/* 响应式调整 */
@media (max-width: 768px) {
  .message-image img {
    max-width: 200px;
    max-height: 200px;
  }
  
  .footer {
    padding: 0 5px;
    gap: 5px;
  }
  
  .footer input {
    margin-left: 0;
  }
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