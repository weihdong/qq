import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'

const getBaseURL = () => import.meta.env.VITE_API_BASE_URL

export const useChatStore = defineStore('chat', () => {
  // 状态
  const currentChat = ref(null)
  const currentChatType = ref('private')
  const messages = ref([])
  const friends = ref([])
  const groups = ref([])
  const socket = ref(null)
  let emitSignal = null // 群聊视频信令处理器

  const currentFriend = computed(() => {
    return friends.value.find(f => f._id === currentChat.value)
  })

  const connectWebSocket = (userId) => {
    const WS_URL = import.meta.env.VITE_WS_URL
    const pingInterval = 25000
    socket.value = new WebSocket(`${WS_URL}?userId=${userId}`)

    socket.value.onopen = () => {
      socket.value.send(JSON.stringify({
        type: 'connect',
        userId
      }))
    }

    socket.value.onerror = (error) => {
      console.error('WebSocket错误:', error)
      setTimeout(() => connectWebSocket(userId), 3000)
    }

    socket.value.onmessage = (event) => {
      const data = JSON.parse(event.data)

      // ✅ 群聊视频信令转发给组件处理
      if (data.type === 'group-call-signal') {
        emitSignal && emitSignal(data)
        return
      }

      // 好友在线状态更新
      if (data.type === 'status-update') {
        const friend = friends.value.find(f => f._id === data.userId)
        if (friend) {
          friend.isOnline = data.status
          friends.value = [...friends.value] // 触发响应式
        }
        return
      }

      // 普通消息（无 type）
      if (!data.type) {
        if (
          data.from === currentChat.value ||
          data.to === currentChat.value
        ) {
          messages.value.push({
            ...data,
            timestamp: new Date(data.timestamp)
          })
        }
        return
      }
    }

    // 心跳机制
    const heartbeat = setInterval(() => {
      if (socket.value.readyState === WebSocket.OPEN) {
        socket.value.send('{}')
      }
    }, pingInterval)

    socket.value.onclose = () => {
      clearInterval(heartbeat)
    }
  }

  const sendMessage = (content) => {
    if (!content.trim() || !currentChat.value) return

    const msg = {
      from: localStorage.getItem('userId'),
      to: currentChat.value,
      content: content.trim(),
      type: currentChatType.value === 'group' ? 'group-message' : 'text'
    }

    socket.value.send(JSON.stringify(msg))
  }

  // ✅ 新增：发送视频信令方法（自动区分私聊/群聊）
  const sendSignal = (signal) => {
    if (!socket.value || socket.value.readyState !== WebSocket.OPEN) return

    const signalType = currentChatType.value === 'group' ? 'group-call-signal' : 'video-signal'

    socket.value.send(JSON.stringify({
      ...signal,
      type: signalType,
      from: localStorage.getItem('userId'),
      to: currentChat.value
    }))
  }

  const loadMessages = async () => {
    try {
      const res = await axios.get(`${getBaseURL()}/api/messages`, {
        params: {
          from: localStorage.getItem('userId'),
          to: currentChat.value
        }
      })
      messages.value = res.data.map(msg => ({
        ...msg,
        _id: msg._id,
        from: msg.from,
        to: msg.to,
        content: msg.content,
        type: msg.type || 'text',
        fileUrl: msg.fileUrl,
        timestamp: new Date(msg.timestamp)
      }))
    } catch (error) {
      console.error('加载消息失败:', error)
    }
  }

  const clearMessages = () => {
    messages.value = []
  }

  const loadFriends = async () => {
    try {
      const res = await axios.get(`${getBaseURL()}/api/friends`, {
        params: { userId: localStorage.getItem('userId') }
      })
      friends.value = res.data.map(friend => ({
        ...friend,
        isOnline: false
      }))
    } catch (error) {
      console.error('加载好友失败:', error)
    }
  }

  const loadGroupMessages = async (groupId) => {
    try {
      const response = await axios.get(`${getBaseURL()}/api/group-messages`, {
        params: { groupId }
      })
      messages.value = response.data.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }))
    } catch (error) {
      console.error('加载群消息失败:', error)
      alert('加载群消息失败')
    }
  }

  const setCurrentChat = (id, type = 'private') => {
    currentChat.value = id
    currentChatType.value = type
  }

  // ✅ 组件订阅群聊信令用
  const onGroupSignal = (cb) => {
    emitSignal = cb
  }

  return {
    currentChat,
    currentChatType,
    messages,
    friends,
    groups,
    currentFriend,
    socket,
    connectWebSocket,
    sendMessage,
    sendSignal,           // ✅ 导出信令发送方法
    loadMessages,
    loadFriends,
    clearMessages,
    loadGroupMessages,
    setCurrentChat,
    onGroupSignal         // ✅ 导出注册信令回调方法
  }
})
