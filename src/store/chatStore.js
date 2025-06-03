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

// 添加文件上传方法
const uploadFile = async (file, duration = 0) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('duration', duration.toString());
    
    const response = await axios.post(`${getBaseURL()}/api/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('文件上传失败:', error);
    throw new Error('文件上传失败');
  }
};

// 修改sendMessage方法支持多媒体
const sendMessage = (content, type = 'text', fileData = null) => {
  if ((!content && !fileData) || !store.currentChat) return;
  
  if (!store.ws || store.ws.readyState !== WebSocket.OPEN) {
    console.log('连接未就绪，尝试重新发送...');
    store.ws = connectWebSocket();
    setTimeout(() => sendMessage(content, type, fileData), 500);
    return;
  }

  try {
    const message = {
      type,
      from: userId,
      to: store.currentChat,
      content: content || fileData?.transcript || '',
      timestamp: new Date().toISOString(),
    };
    
    if (fileData) {
      message.fileUrl = fileData.fileUrl;
      if (type === 'audio') {
        message.duration = fileData.duration;
      }
    }
    
    store.ws.send(JSON.stringify(message));
    
    // 添加到本地消息列表
    store.messages.push({
      ...message,
      _id: Date.now().toString(), // 临时ID，后端会替换
      timestamp: new Date()
    });
    
    return true;
  } catch (error) {
    console.error('发送消息失败:', error);
    alert('消息发送失败，请检查网络连接');
    return false;
  }
};



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
        timestamp: new Date(msg.timestamp)
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
      
      if (Array.isArray(res.data)) {
        // 初始化在线状态
        friends.value = res.data.map(friend => ({
          ...friend,
          isOnline: false // 默认离线，等待WebSocket更新
        }))
      } else {
        console.error('返回的数据格式不正确，期望是数组', res.data);
      }
      
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
    ws: socket,
    loadMessages,
    loadFriends,
    uploadFile
  }
})