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
          <!-- 消息内容展示区 - 根据消息类型渲染不同内容 -->
          <div v-if="msg.type === 'text'" class="message-content">{{ msg.content }}</div>
          <div v-else-if="msg.type === 'emoji'" class="emoji-message">
            <span class="emoji">{{ msg.content }}</span>
          </div>
          <div v-else-if="msg.type === 'image'" class="image-message">
            <img :src="msg.content" @click="showImagePreview(msg.content)" alt="发送的图片">
          </div>
          <div v-else-if="msg.type === 'audio'" class="audio-message">
            <audio controls>
              <source :src="msg.content" type="audio/mpeg">
            </audio>
          </div>
        </div>
      </div>
    </div>


 <!-- 底栏 -->
 <div class="footer">
      <!-- 表情按钮 -->
      <div class="emoji-btn" @click="toggleEmojiPicker">😀</div>
      
      <!-- 输入区域 -->
      <input
        v-model="newMessage"
        @keyup.enter="sendTextMessage"
        :placeholder="currentPlaceholder"
        ref="messageInput"
      >
      
      <!-- 图片上传按钮 -->
      <input 
        type="file" 
        accept="image/*" 
        ref="fileInput" 
        @change="handleImageUpload"
        style="display: none"
      >
      <div class="image-btn" @click="triggerFileInput">🖼️</div>
      
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
      <span 
        v-for="(emoji, index) in emojis" 
        :key="index"
        @click="selectEmoji(emoji)"
      >
        {{ emoji }}
      </span>
    </div>
    
    <!-- 图片预览 -->
    <div v-if="previewImage" class="image-preview" @click="previewImage = null">
      <img :src="previewImage" alt="预览图片">
    </div>
    
    <!-- 录音指示器 -->
    <div v-if="isRecording" class="recording-indicator">
      <div class="pulse"></div>
      <div>录制中... {{ recordingDuration }}秒</div>
      <button @click="cancelRecording">取消</button>
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
const showEmojiPicker = ref(false)
const previewImage = ref(null)
const isRecording = ref(false)
const mediaRecorder = ref(null)
const audioChunks = ref([])
const recordingDuration = ref(0)
const recordingTimer = ref(null)
const fileInput = ref(null)
const messageInput = ref(null)

// 常用表情列表
const emojis = ref([
  '😀', '😂', '😍', '😎', '👍', 
  '❤️', '🔥', '🙏', '🎉', '💯',
  '🤔', '😢', '🤣', '🥰', '🤩',
  '😊', '🙌', '👏', '👋', '💪'
])

// 切换表情选择器
const toggleEmojiPicker = () => {
  showEmojiPicker.value = !showEmojiPicker.value
}

// 选择表情
const selectEmoji = (emoji) => {
  newMessage.value += emoji
  showEmojiPicker.value = false
  nextTick(() => {
    messageInput.value.focus()
  })
}

// 触发图片选择
const triggerFileInput = () => {
  fileInput.value.click()
}

// 修改后的图片上传方法
const handleImageUpload = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  try {
    // 创建预览URL
    const previewUrl = URL.createObjectURL(file);
    showImagePreview(previewUrl);
    
    // 上传图片到服务器
    const formData = new FormData();
    formData.append('file', file); // 修改字段名为 'file'
    
    const response = await axios.post(`${getBaseURL()}/api/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    // 发送图片消息
    sendMessage(response.data.url, 'image');
    
  } catch (error) {
    console.error('图片上传失败:', error);
    alert(`图片上传失败: ${error.response?.data?.error || error.message}`);
  } finally {
    // 重置文件输入
    e.target.value = '';
  }
}

// 图片预览
const showImagePreview = (url) => {
  previewImage.value = url
}

// 开始录音
const startRecording = async () => {
  try {
    if (isRecording.value) return
    
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRecorder.value = new MediaRecorder(stream)
    audioChunks.value = []
    
    mediaRecorder.value.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.value.push(event.data)
      }
    }
    
    mediaRecorder.value.onstop = async () => {
      const audioBlob = new Blob(audioChunks.value, { type: 'audio/mpeg' })
      const audioUrl = URL.createObjectURL(audioBlob)
      
      // 上传音频到服务器
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.mp3')
      
      const response = await axios.post(`${getBaseURL()}/api/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      
      // 发送音频消息
      sendMessage(response.data.url, 'audio')
      
      // 清理
      stream.getTracks().forEach(track => track.stop())
    }
    
    mediaRecorder.value.start()
    isRecording.value = true
    recordingDuration.value = 0
    
    // 计时器
    recordingTimer.value = setInterval(() => {
      recordingDuration.value++
    }, 1000)
    
  } catch (error) {
    console.error('录音失败:', error)
    alert('无法访问麦克风')
  }
}

// 修改后的语音上传方法
const stopRecording = () => {
  if (isRecording.value && mediaRecorder.value) {
    mediaRecorder.value.stop();
    isRecording.value = false;
    clearInterval(recordingTimer.value);
    
    // 创建FormData上传
    const audioBlob = new Blob(audioChunks.value, { type: 'audio/mpeg' });
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.mp3'); // 修改字段名为 'file'
    
    axios.post(`${getBaseURL()}/api/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    .then(response => {
      sendMessage(response.data.url, 'audio');
    })
    .catch(error => {
      console.error('音频上传失败:', error);
      alert(`音频上传失败: ${error.response?.data?.error || error.message}`);
    });
  }
}

// 取消录音
const cancelRecording = () => {
  if (isRecording.value) {
    mediaRecorder.value.stop()
    isRecording.value = false
    clearInterval(recordingTimer.value)
    audioChunks.value = []
  }
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

// 发送消息（增强版）
const sendMessage = (content, type = 'text') => {
  if (!content) return

  if (!store.ws || store.ws.readyState !== WebSocket.OPEN) {
    console.log('连接未就绪，尝试重新发送...')
    store.ws = connectWebSocket()
    setTimeout(() => sendMessage(content, type), 500)
    return
  }

  try {
    const message = {
      type,
      from: userId,
      to: store.currentChat,
      content: content,
      timestamp: new Date().toISOString()
    }
    
    store.ws.send(JSON.stringify(message))
    
    // 如果是文本消息，清空输入框
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
  if (!newMessage.value.trim()) return
  sendMessage(newMessage.value.trim(), 'text')
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

/* 新增样式 */
.emoji-picker {
  position: absolute;
  bottom: 80px;
  right: 20px;
  width: 250px;
  height: 200px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 5px 15px rgba(0,0,0,0.1);
  padding: 10px;
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
  overflow-y: auto;
  z-index: 1000;
}

.emoji-picker span {
  font-size: 24px;
  cursor: pointer;
  text-align: center;
  transition: transform 0.2s;
}

.emoji-picker span:hover {
  transform: scale(1.2);
}

.image-preview {
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

.image-preview img {
  max-width: 90%;
  max-height: 90%;
}

.recording-indicator {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0,0,0,0.7);
  color: white;
  padding: 20px;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 2000;
}

.pulse {
  width: 60px;
  height: 60px;
  background: red;
  border-radius: 50%;
  margin-bottom: 15px;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { transform: scale(0.9); box-shadow: 0 0 0 0 rgba(255, 0, 0, 0.7); }
  70% { transform: scale(1); box-shadow: 0 0 0 15px rgba(255, 0, 0, 0); }
  100% { transform: scale(0.9); box-shadow: 0 0 0 0 rgba(255, 0, 0, 0); }
}

/* 消息气泡内的不同类型内容 */
.emoji-message {
  font-size: 3em;
  line-height: 1.2;
}

.image-message img {
  max-width: 200px;
  max-height: 200px;
  border-radius: 10px;
  cursor: pointer;
}

.audio-message audio {
  width: 200px;
}

/* 底栏按钮样式 */
.footer > div, .footer > button {
  cursor: pointer;
  padding: 0 12px;
  font-size: 1.5em;
}

/* 响应式调整 */
@media (max-width: 480px) {
  .emoji-picker {
    width: 90%;
    left: 5%;
    right: auto;
  }
  
  .image-message img {
    max-width: 150px;
  }
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