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
            <div v-if="!msg.type || msg.type === 'text'" class="message-content">
              {{ msg.content }}
            </div>
            
            <!-- 图片消息 -->
            <img 
              v-else-if="msg.type === 'image'" 
              :src="msg.content" 
              class="message-image"
              alt="图片"
            >
            
            <!-- 语音消息 -->
            <div v-else-if="msg.type === 'audio'" class="audio-message">
              <audio :src="msg.content" controls class="audio-player"></audio>
            </div>
          </div>
        </div>
      </div>
      <!-- 底栏 -->
      <div class="footer">     
        <input
          v-model="newMessage"
          @keyup.enter="sendMessage"
          :placeholder="currentPlaceholder"
        >
        <!-- 新增图片上传按钮 -->
        <label for="image-upload" class="footer-btn">
          <span class="icon">🌁</span>
        </label>
        <input 
          id="image-upload" 
          type="file" 
          accept="image/*" 
          style="display: none"
          @change="handleImageUpload"
        >
        
        <!-- 新增语音消息按钮 -->
        <button class="footer-btn" @click="toggleVoiceRecord">
          <span class="icon">{{ isRecording ? '⏹️' : '🎤' }}</span>
        </button>
        <button @click="sendMessage">发送</button>
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

  // ChatView.vue - 在 setup() 中添加以下代码
const isOnline = ref(navigator.onLine);

const handleOnline = () => {
  isOnline.value = true;
  console.log('🌐 网络恢复，尝试重连WebSocket');
  store.connectWebSocket(localStorage.getItem('userId'));
};

const handleOffline = () => {
  isOnline.value = false;
  console.warn('🌐 网络连接丢失');
};

onMounted(() => {
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  // 添加连接状态指示器
  console.log('网络状态:', isOnline.value ? '在线' : '离线');
});

onUnmounted(() => {
  window.removeEventListener('online', handleOnline);
  window.removeEventListener('offline', handleOffline);
});
  
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
// 删除 ChatView.vue 中整个 connectWebSocket 函数
// 改为使用 store 的统一连接

// 在 onMounted 中简化：
onMounted(async () => {
  await store.loadFriends();
  store.connectWebSocket(localStorage.getItem('userId'));
  
  if (store.currentChat) {
    await store.loadMessages();
  }
});
  
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
  
// ChatView.vue - 替换 addFriend 函数
const addFriend = async () => {
  try {
    // 确保用户名是字符串且非空
    const name = newFriendName.value;
    if (typeof name !== 'string' || !name.trim()) {
      alert('请输入有效的用户名');
      return;
    }

    const response = await axios.post(`${getBaseURL()}/api/friends`, {
      userId: localStorage.getItem('userId'),
      friendUsername: name.trim()
    });

    if (response.data?.friendId) {
      // 获取好友信息
      const friendInfo = await axios.get(`${getBaseURL()}/api/user/${response.data.friendId}`);
      
      // 添加到好友列表
      store.friends.push({
        _id: response.data.friendId,
        username: friendInfo.data.username,
        isOnline: false
      });
      
      toggleAddFriend();
      alert(`成功添加好友: ${friendInfo.data.username}`);
    }
  } catch (error) {
    let errorMessage = '添加失败，请重试';
    if (error.response) {
      switch (error.response.data.code) {
        case 'FRIEND_NOT_FOUND': errorMessage = '用户不存在'; break;
        case 'ALREADY_FRIENDS': errorMessage = '已是好友关系'; break;
        case 'SELF_ADDITION': errorMessage = '不能添加自己'; break;
        default: errorMessage = error.response.data.error || errorMessage;
      }
    }
    alert(`错误: ${errorMessage}`);
    console.error('添加好友失败详情:', error.response?.data || error.message);
  }
};
  
  // 选择好友
  const selectFriend = async (friendId) => {
    store.currentChat = friendId
    await store.loadMessages()
  }
  
// 新增响应式变量
const isRecording = ref(false)
let mediaRecorder = null
let audioChunks = ref([])

// 图片上传处理
const handleImageUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return
  
  try {
    // 检查文件类型
    if (!file.type.match('image.*')) {
      alert('请选择图片文件')
      return
    }
    
    // 限制图片大小 (例如2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('图片大小不能超过2MB')
      return
    }
    
    const reader = new FileReader()
    reader.onload = async (e) => {
      // 获取Base64编码的图片
      const base64Image = e.target.result
      
      // 发送图片消息
      if (store.ws && store.ws.readyState === WebSocket.OPEN) {
        const message = {
          type: 'image',
          from: userId,
          to: store.currentChat,
          content: base64Image,
          timestamp: new Date().toISOString()
        }
        
        store.ws.send(JSON.stringify(message))
        store.messages.push(message)
      } else {
        console.error('WebSocket连接未就绪')
        alert('发送失败，请检查网络连接')
      }
    }
    
    reader.readAsDataURL(file)
    // 重置input，允许再次选择同一文件
    event.target.value = ''
  } catch (error) {
    console.error('图片上传失败:', error)
    alert('图片上传失败')
  }
}

// 语音录制功能
const toggleVoiceRecord = async () => {
  if (isRecording.value) {
    // 停止录音
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
    }
    isRecording.value = false
    return
  }
  
  try {
    // 请求麦克风权限
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRecorder = new MediaRecorder(stream)
    audioChunks.value = []
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.value.push(event.data)
      }
    }
    
    mediaRecorder.onstop = async () => {
      // 合并音频片段
      const audioBlob = new Blob(audioChunks.value, { type: 'audio/webm' })
      
      // 转换为Base64
      const reader = new FileReader()
      reader.onload = () => {
        const base64Audio = reader.result
        
        // 发送语音消息
        if (store.ws && store.ws.readyState === WebSocket.OPEN) {
          const message = {
            type: 'audio',
            from: userId,
            to: store.currentChat,
            content: base64Audio,
            timestamp: new Date().toISOString()
          }
          
          store.ws.send(JSON.stringify(message))
          store.messages.push(message)
        }
      }
      
      reader.readAsDataURL(audioBlob)
      
      // 关闭媒体流
      stream.getTracks().forEach(track => track.stop())
    }
    
    // 开始录音
    mediaRecorder.start()
    isRecording.value = true
    
    // 设置60秒自动停止
    setTimeout(() => {
      if (isRecording.value) {
        toggleVoiceRecord()
      }
    }, 60000)
  } catch (error) {
    console.error('无法访问麦克风:', error)
    alert('无法访问麦克风，请检查权限设置')
  }
}

// ChatView.vue - 替换 sendMessage 函数
const sendMessage = () => {
  // 确保消息是字符串且非空
  if (typeof newMessage.value !== 'string' || !newMessage.value.trim()) {
    console.warn('发送消息失败: 消息为空或非字符串');
    return;
  }
  
  // 创建临时消息（立即显示）
  const tempMessage = {
    _id: `temp_${Date.now()}`,
    type: 'text',
    from: userId,
    to: store.currentChat,
    content: newMessage.value.trim(),
    timestamp: new Date().toISOString(),
    isTemp: true
  };
  
  // 添加到消息列表
  store.messages.push(tempMessage);
  
  // 通过 store 发送消息
  store.sendMessage(newMessage.value.trim());
  
  // 清空输入框
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
  
  // 消息自动滚动
  watch(() => store.messages, async () => {
    await nextTick()
    if (chatArea.value) {
      chatArea.value.scrollTop = chatArea.value.scrollHeight
    }
  }, { deep: true })
  
// 在 onMounted 中初始化
onMounted(async () => {
  try {
    await store.loadFriends();
    
    // 统一使用 store 的 socket
    store.connectWebSocket(userId);
    
    // 加载当前聊天消息（如果有）
    if (store.currentChat) {
      await store.loadMessages();
    }
  } catch (error) {
    console.error('初始化失败:', error);
  }
});
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

/* 底栏按钮样式 */
.footer-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #f0f0f0;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin: 0 5px;
  transition: background 0.3s;
}

.footer-btn:hover {
  background: #e0e0e0;
}

.footer-btn .icon {
  font-size: 18px;
}

/* 图片消息样式 */
.message-image {
  max-width: 100%;
  max-height: 300px;
  border-radius: 10px;
  display: block;
}

/* 语音消息样式 */
.audio-message {
  display: flex;
  align-items: center;
}

.audio-player {
  flex: 1;
  height: 40px;
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