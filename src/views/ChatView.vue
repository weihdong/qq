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
<!-- 模板需要调整为 -->
      <div class="chat-area" ref="chatArea">
         <div 
            v-for="msg in store.messages"
            :key="msg._id"
            :class="['message-container', { 'own-message': msg.from === userId }]"
        >
         <div class="message-time">{{ formatTime(msg.timestamp) }}</div>
         <div class="message-bubble">
           <div class="message-content">{{ msg.content }}</div>
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
  
  // 获取基础URL
  const getBaseURL = () => {
    return window.location.hostname.includes('085410.xyz') 
      ? 'https://web-production-5fc08.up.railway.app'
      : 'http://localhost:3000'
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
    return store.friends.find(f =>f._id === store.currentChat)
})
const currentPlaceholder = computed(() => {
    if(!store.currentChat) return '点击顶栏头像进行聊天吧！'
    return currentFriend.value
     ?`输入消息给${currentFriend.value.username}`
     :'正在加载用户信息...'
})

const addFriend = async () => {
  try {
    if (!newFriendName.value.trim()) {
      alert('请输入好友用户名')
      return
    }

    // 修改请求参数字段名
    const response = await axios.post(`${getBaseURL()}/api/friends`, {
      userId: localStorage.getItem('userId'),
      friendUsername: newFriendName.value.trim() // 修正字段名
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    })

    // 调整响应处理逻辑
    if (response.data && response.data.friendId) {
      store.friends.push({
        _id: response.data.friendId,
        username: response.data.username
      })
      toggleAddFriend()
    } else {
      throw new Error('添加好友失败')
    }
  } catch (error) {
    const errorMsg = error.response?.data?.error || '添加好友失败'
    alert(`错误: ${errorMsg}`)
    console.error('添加好友失败详情:', error.response?.data)
  }
}
  
  // 选择好友
  const selectFriend = async (friendId) => {
    store.currentChat = friendId
    await store.loadMessages()
  }
  
  // 发送消息
  const sendMessage = () => {
  if (newMessage.value.trim() && store.currentChat && store.ws) {
    const message = {
      type: 'message',
      from: userId,
      to: store.currentChat,
      content: newMessage.value.trim()
    };
    store.ws.send(JSON.stringify(message));
    newMessage.value = '';
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
  
  // 初始化加载好友列表
  onMounted(async () => {
  try {
    // 获取好友列表
    const friendsRes = await axios.get(`${getBaseURL()}/api/friends`, {
      params: { userId }
    });
    store.friends = friendsRes.data.friends.map(f => ({
      ...f,
      isOnline: false // 初始化为离线状态
    }));

    // WebSocket连接
    const ws = new WebSocket(`wss://web-production-5fc08.up.railway.app`);
    ws.userId = userId;
    
    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'connect',
        userId
      }));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'message') {
        store.messages.push(message);
      }
      if (message.type === 'status') {
        const friend = store.friends.find(f => f._id === message.userId);
        if (friend) friend.isOnline = message.online;
      }
    };

    store.ws = ws;
  } catch (error) {
    console.error('初始化失败:', error);
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
  border-radius: 26px;
  padding: 0 20px;
  font-size: 16px;
  background: white;
  transition: all 0.2s;
  margin-left: 4%;
}

.footer input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(255,107,53,0.1);
  outline: none;
}

/* 发送按钮 */
.footer button {
  width: 88px;
  height: 48px;
  background: orange;
  color: black;
  border: none;
  border-radius: 26px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  margin-right: 4%;
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


</style>