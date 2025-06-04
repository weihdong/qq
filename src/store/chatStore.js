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
  const connectWebSocket = (userId) => {
    const WS_URL = import.meta.env.VITE_WS_URL

    const pingInterval = 25000;
    socket.value = new WebSocket(`${WS_URL}?userId=${userId}`)
    socket.value.error = (error) => {
        console.error('WebSocket错误:', error);
        setTimeout(() => connectWebSocket(userId), 3000);
    }
    socket.value.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      // 处理消息
      if (!data.type) { // 普通消息
        if (data.from === currentChat.value || data.to === currentChat.value) {
          messages.value.push({
            ...data,
            timestamp: new Date(data.timestamp)
          })
        }
        return
      }

      // 处理状态更新
      if (data.type === 'status-update') {
        const friend = friends.value.find(f => f._id === data.userId)
        if (friend) {
          friend.isOnline = data.status
          friends.value = [...friends.value] // 触发响应式更新
        }
      }
    }

    // 心跳检测
    const heartbeat = setInterval(() => {
      if (socket.value.readyState === WebSocket.OPEN) {
        socket.value.send('{}');
      }
    }, pingInterval);

    // 清理
    socket.value.onclose = () => {
      clearInterval(heartbeat);
    };
  }

  const sendMessage = (content) => {
    if (!content.trim() || !currentChat.value) return
    const msg = {
      from: localStorage.getItem('userId'),
      to: currentChat.value,
      content: content.trim()
    }
    socket.value.send(JSON.stringify(msg))
  }

// 修改加载消息方法
const loadMessages = async () => {
  try {
    const res = await axios.get(`${getBaseURL()}/api/messages`, {
      params: {
        from: localStorage.getItem('userId'),
        to: currentChat.value
      }
    })
    
    // 添加消息类型处理
    messages.value = res.data.map(msg => ({
      ...msg,
      timestamp: new Date(msg.timestamp),
      type: msg.type || 'text' // 默认文本类型
    }))
  } catch (error) {
    console.error('加载消息失败:', error)
  }
}

  const loadFriends = async () => {
    try {
      const res = await axios.get(`${getBaseURL()}/api/friends`, {
        params: { userId: localStorage.getItem('userId') }
      })
      
      // 初始化在线状态
      friends.value = res.data.map(friend => ({
        ...friend,
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