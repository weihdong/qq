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
  <!-- 聊天区域 -->
  <div class="chat-area" ref="chatArea">
    <div 
      v-for="msg in store.messages"
      :key="msg._id"
      :class="['message-container', { 'own-message': msg.from === userId }]"
    >
      <div class="message-time">{{ formatTime(msg.timestamp) }}</div>
      
      <!-- 文本消息 -->
      <div v-if="msg.type === 'text'" class="message-bubble">
        <div class="message-content">{{ msg.content }}</div>
      </div>
      
      <!-- 表情消息 -->
      <div v-if="msg.type === 'emoji'" class="emoji-message">
        <img :src="msg.content" class="emoji-img" alt="表情">
      </div>
      
      <!-- 图片消息 -->
      <div v-if="msg.type === 'image'" class="image-message">
        <img :src="msg.fileUrl" class="image-preview" @click="openImage(msg.fileUrl)">
      </div>
      
      <!-- 语音消息 -->
      <div v-if="msg.type === 'audio'" class="audio-message">
        <audio controls :src="msg.fileUrl" class="audio-player"></audio>
        <div class="audio-duration">{{ formatDuration(msg.content) }}</div>
      </div>
    </div>
  </div>
    <!-- 底栏修改 -->
    <div class="footer">
      <!-- 表情按钮 -->
      <div class="emoji-btn" @click="toggleEmojiPicker">😊</div>
      
      <!-- 消息输入框 -->
      <input
        v-model="newMessage"
        @keyup.enter="sendTextMessage"
        :placeholder="currentPlaceholder"
        ref="messageInput"
      >
      
      <!-- 图片上传按钮 -->
      <div class="file-btn" @click="triggerFileUpload">
        <input 
          type="file" 
          ref="fileInput" 
          accept="image/*" 
          @change="handleImageUpload"
          style="display: none"
        >
        📷
      </div>
      
      <!-- 语音录制按钮 -->
      <button 
        class="voice-btn"
        @mousedown="startRecording"
        @mouseup="stopRecording"
        @touchstart="startRecording"
        @touchend="stopRecording"
      >
        🎤
      </button>
      
      <!-- 发送按钮 -->
      <button @click="sendTextMessage">发送</button>
    </div>
    
    <!-- 表情选择器 -->
    <div v-if="showEmojiPicker" class="emoji-picker">
      <div 
        v-for="(emoji, index) in emojis" 
        :key="index"
        @click="selectEmoji(emoji)"
      >
        <img :src="emoji.url" class="emoji-option">
      </div>
    </div>
    
    <!-- 图片预览模态框 -->
    <div v-if="previewImage" class="image-preview-modal" @click="previewImage = null">
      <img :src="previewImage" class="full-image">
    </div>
    
    <!-- 录音指示器 -->
    <div v-if="isRecording" class="recording-overlay">
      <div class="recording-indicator">
        <div class="pulse"></div>
        <div class="text">录制中... {{ recordingDuration }}秒</div>
        <button class="cancel-btn" @click="cancelRecording">取消</button>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, onMounted, nextTick, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '@/store/chatStore'
import axios from 'axios'

const router = useRouter()
const store = useChatStore()
const newMessage = ref('')
const userId = localStorage.getItem('userId')
const chatArea = ref(null)
const showAddFriendModal = ref(false)
const newFriendName = ref('')
// 新增表情包 - QQ表情
const EMOJI_BASE_URL = 'https://unpkg.com/@waline/emojis@1.2.0/tieba'
const emojis = ref([
  { name: '微笑', url: `${EMOJI_BASE_URL}/tieba_agree.png` },
  { name: '憨笑', url: `${EMOJI_BASE_URL}/tieba_look_down.png` },
  { name: '色', url: `${EMOJI_BASE_URL}/tieba_sunglasses.png` },
  { name: '发呆', url: `${EMOJI_BASE_URL}/tieba_awkward.png` },
  { name: '得意', url: `${EMOJI_BASE_URL}/tieba_sleep.png` }
])

// 新增状态变量
const showEmojiPicker = ref(false)
const fileInput = ref(null)
const previewImage = ref(null)
const isRecording = ref(false)
const mediaRecorder = ref(null)
const audioChunks = ref([])
const recordingDuration = ref(0)
const recordingTimer = ref(null)
const messageInput = ref(null)

// 获取当前时间戳
const getCurrentTime = () => {
  return new Date().toISOString()
}

// 切换表情选择器
const toggleEmojiPicker = () => {
  showEmojiPicker.value = !showEmojiPicker.value
}

// 选择表情
const selectEmoji = (emoji) => {
  sendMessage('emoji', emoji.url)
  showEmojiPicker.value = false
}

// 触发文件上传
const triggerFileUpload = () => {
  fileInput.value.click()
}

// 处理图片上传
const handleImageUpload = async (e) => {
  const file = e.target.files[0]
  if (!file) return
  
  try {
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await axios.post(`${getBaseURL()}/api/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    
    if (response.data.url) {
      sendMessage('image', null, response.data.url)
    }
  } catch (error) {
    console.error('图片上传失败:', error)
    alert('图片上传失败')
  } finally {
    // 重置input
    e.target.value = ''
  }
}

// 打开图片预览
const openImage = (url) => {
  previewImage.value = url
}

// 开始录音
const startRecording = async (e) => {
  if (e.type === 'mousedown' && e.button !== 0) return // 只响应左键
  e.preventDefault()
  
  try {
    audioChunks.value = []
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRecorder.value = new MediaRecorder(stream)
    
    mediaRecorder.value.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.value.push(event.data)
      }
    }
    
    mediaRecorder.value.onstop = async () => {
      stream.getTracks().forEach(track => track.stop())
      
      if (audioChunks.value.length > 0) {
        const audioBlob = new Blob(audioChunks.value, { type: 'audio/webm' })
        await uploadAudio(audioBlob)
      }
    }
    
    mediaRecorder.value.start()
    isRecording.value = true
    recordingDuration.value = 0
    
    // 开始计时
    recordingTimer.value = setInterval(() => {
      recordingDuration.value += 1
      // 最长60秒
      if (recordingDuration.value >= 60) {
        stopRecording()
      }
    }, 1000)
  } catch (error) {
    console.error('录音失败:', error)
    alert('无法访问麦克风，请检查权限设置')
  }
}

// 停止录音
const stopRecording = () => {
  if (mediaRecorder.value && isRecording.value) {
    mediaRecorder.value.stop()
    clearInterval(recordingTimer.value)
    isRecording.value = false
  }
}

// 取消录音
const cancelRecording = () => {
  if (mediaRecorder.value) {
    mediaRecorder.value.stop()
  }
  clearInterval(recordingTimer.value)
  isRecording.value = false
  audioChunks.value = []
}

// 上传音频文件
const uploadAudio = async (audioBlob) => {
  try {
    const formData = new FormData()
    formData.append('file', audioBlob, 'recording.webm')
    
    const response = await axios.post(`${getBaseURL()}/api/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    
    if (response.data.url) {
      sendMessage('audio', recordingDuration.value, response.data.url)
    }
  } catch (error) {
    console.error('音频上传失败:', error)
    alert('音频上传失败')
  }
}

// 格式化录音时长
const formatDuration = (seconds) => {
  return `${seconds}秒`
}
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

  // 修改消息处理逻辑
  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data)
      
      // 统一处理所有消息
      if (message.type === 'message') {
        // 确保消息格式正确
        const newMessage = {
          ...message.data,
          _id: message.data._id,
          from: message.data.from,
          to: message.data.to,
          content: message.data.content,
          type: message.data.type,
          fileUrl: message.data.fileUrl,
          timestamp: new Date(message.data.timestamp)
        }
        
        // 添加到消息列表
        store.messages.push(newMessage)
        
        // 更新好友状态
        if (newMessage.type === 'status') {
          const friend = store.friends.find(f => f._id === newMessage.userId)
          if (friend) friend.isOnline = newMessage.online
        }
      }
      // 系统消息
      else if (message.type === 'system') {
        console.log('系统消息:', message.message)
      }
    } catch (error) {
      console.error('消息处理错误:', error)
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

const selectFriend = async (friendId) => {
  // 清除当前消息
  store.clearMessages();
  
  // 设置当前聊天
  store.currentChat = friendId;
  
  // 加载新消息
  await store.loadMessages();
}

// 发送消息（增强版）
const sendMessage = (type, content = null, fileUrl = null) => {
  if (!store.currentChat) {
    alert('请先选择好友')
    return
  }
  
  if (type === 'text' && !newMessage.value.trim()) return
  
  if (!store.ws || store.ws.readyState !== WebSocket.OPEN) {
    console.log('连接未就绪，尝试重新发送...')
    store.ws = connectWebSocket()
    setTimeout(() => sendMessage(type, content, fileUrl), 500)
    return
  }
  
  try {
    const message = {
      type,
      from: userId,
      to: store.currentChat,
      content: type === 'text' ? newMessage.value.trim() : content,
      fileUrl,
      timestamp: getCurrentTime()
    }
    
    store.ws.send(JSON.stringify(message))
    
    // 清空文本输入
    if (type === 'text') {
      newMessage.value = ''
    }
  } catch (error) {
    console.error('发送消息失败:', error)
    alert('消息发送失败，请检查网络连接')
  }
}

// 发送文本消息
const sendTextMessage = () => {
  sendMessage('text')
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

/* 新增样式 */
.emoji-btn, .file-btn, .voice-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  cursor: pointer;
  background: white;
  border-radius: 50%;
  margin: 0 5px;
  user-select: none;
}

.emoji-btn:hover, .file-btn:hover, .voice-btn:hover {
  background: #f0f0f0;
}

/* 表情选择器 */
.emoji-picker {
  position: fixed;
  bottom: 80px;
  left: 10px;
  width: 300px;
  height: 200px;
  background: white;
  border-radius: 10px;
  box-shadow: 0 5px 15px rgba(0,0,0,0.1);
  display: flex;
  flex-wrap: wrap;
  overflow-y: auto;
  padding: 10px;
  z-index: 1000;
}

.emoji-option {
  width: 30px;
  height: 30px;
  margin: 5px;
  cursor: pointer;
  transition: transform 0.2s;
}

.emoji-option:hover {
  transform: scale(1.2);
}

/* 消息样式 */
.emoji-message img {
  width: 60px;
  height: 60px;
}

.image-message img {
  max-width: 200px;
  max-height: 200px;
  border-radius: 10px;
  cursor: pointer;
}

.audio-message {
  display: flex;
  align-items: center;
  gap: 10px;
}

.audio-player {
  width: 200px;
}

.audio-duration {
  font-size: 14px;
  color: #666;
}

/* 图片预览模态框 */
.image-preview-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.full-image {
  max-width: 90%;
  max-height: 90%;
}

/* 录音指示器 */
.recording-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
}

.recording-indicator {
  background: white;
  padding: 30px;
  border-radius: 20px;
  text-align: center;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
}

.pulse {
  width: 80px;
  height: 80px;
  background: #ff4d4d;
  border-radius: 50%;
  margin: 0 auto 20px;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { transform: scale(0.9); box-shadow: 0 0 0 0 rgba(255, 77, 77, 0.7); }
  70% { transform: scale(1); box-shadow: 0 0 0 20px rgba(255, 77, 77, 0); }
  100% { transform: scale(0.9); box-shadow: 0 0 0 0 rgba(255, 77, 77, 0); }
}

.cancel-btn {
  margin-top: 20px;
  padding: 10px 20px;
  background: #f0f0f0;
  border: none;
  border-radius: 20px;
  cursor: pointer;
}
</style>