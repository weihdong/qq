import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'

const getBaseURL = () => import.meta.env.VITE_API_BASE_URL

export const useChatStore = defineStore('chat', () => {
  // 状态
  const currentChat = ref(null)
  const messages = ref([])
  const friends = ref([])
  const socket = ref(null)
  
  // 计算属性
  const currentFriend = computed(() => {
    return friends.value.find(f => f._id === currentChat.value)
  })

  // 方法

// 在 chatStore.js 中完善 WebSocket 管理
let heartbeatInterval = null

const connectWebSocket = (userId) => {
  // 关闭现有连接
  if (socket.value) {
    socket.value.close()
    clearInterval(heartbeatInterval)
  }

  const WS_URL = import.meta.env.VITE_WS_URL
  socket.value = new WebSocket(`${WS_URL}?userId=${userId}`)
  
  socket.value.onopen = () => {
    console.log('WebSocket连接成功')
    socket.value.send(JSON.stringify({
      type: 'connect',
      userId
    }))
    
    // 心跳机制
    heartbeatInterval = setInterval(() => {
      if (socket.value.readyState === WebSocket.OPEN) {
        socket.value.send(JSON.stringify({ type: 'ping' }))
      }
    }, 25000)
  }
  
  socket.value.onmessage = (event) => {
    const data = JSON.parse(event.data)
    
    // 处理状态更新
    if (data.type === 'status-update') {
      const friend = friends.value.find(f => f._id === data.userId)
      if (friend) {
        friend.isOnline = data.status
      }
      return
    }
    
    // 处理消息
    if (['text', 'image', 'audio'].includes(data.type)) {
      messages.value.push({
        ...data,
        timestamp: new Date(data.timestamp)
      })
    }
  }
  
  socket.value.onerror = (error) => {
    console.error('WebSocket错误:', error)
  }
  
  socket.value.onclose = () => {
    clearInterval(heartbeatInterval)
    console.log('连接关闭，5秒后重连...')
    setTimeout(() => connectWebSocket(userId), 5000)
  }
}

// 添加 clearMessages 方法
const clearMessages = () => {
  messages.value = [];
};

// 更新 loadMessages 方法
const loadMessages = async () => {
  if (!currentChat.value) return;
  
  try {
    const res = await axios.get(`${getBaseURL()}/api/messages`, {
      params: {
        from: localStorage.getItem('userId'),
        to: currentChat.value
      }
    });
    
    messages.value = res.data.map(msg => ({
      ...msg,
      _id: msg._id.toString(), // 确保 ID 是字符串
      from: msg.from.toString(),
      to: msg.to.toString(),
      timestamp: new Date(msg.timestamp)
    }));
  } catch (error) {
    console.error('加载消息失败:', error);
  }
};

// 更新 sendMessage 方法
const sendMessage = (content) => {
  if (!content.trim() || !currentChat.value) return;
  
  const msg = {
    type: 'text',
    from: localStorage.getItem('userId'),
    to: currentChat.value,
    content: content.trim(),
    timestamp: new Date().toISOString()
  };
  
  if (socket.value && socket.value.readyState === WebSocket.OPEN) {
    socket.value.send(JSON.stringify(msg));
  } else {
    console.error('WebSocket连接未就绪');
  }
};

  const loadFriends = async () => {
    try {
      const res = await axios.get(`${getBaseURL()}/api/friends`, {
        params: { userId: localStorage.getItem('userId') }
      })
      
      // 初始化在线状态
      friends.value = res.data.friends.map(friend => ({
        _id: friend._id,
        username: friend.username,
        isOnline: false // 默认离线，等待WebSocket更新
      }))
      
    } catch (error) {
      console.error('加载好友失败:', error)
    }
  }

  return {
    currentChat,
    messages,
    friends,
    currentFriend,
    connectWebSocket,
    sendMessage,
    loadMessages,
    loadFriends
  }
})