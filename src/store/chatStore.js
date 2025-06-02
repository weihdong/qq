import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'

const getBaseURL = () => import.meta.env.VITE_API_BASE_URL

// chatstore.js - 在文件顶部添加
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_BASE = 2000; // 2秒基础重连延迟

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

// chatstore.js - 替换整个 connectWebSocket 函数
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_BASE = 2000; // 2秒基础重连延迟

const connectWebSocket = (userId) => {
  // 如果已有活跃连接或正在连接，则跳过
  if (socket.value && [WebSocket.OPEN, WebSocket.CONNECTING].includes(socket.value.readyState)) {
    console.log('WebSocket 连接已存在或正在连接，跳过重连');
    return;
  }

  // 关闭现有连接
  if (socket.value) {
    socket.value.close();
    clearInterval(heartbeatInterval);
  }

  const WS_URL = import.meta.env.VITE_WS_URL;
  console.log(`🔄 正在连接 WebSocket: ${WS_URL}?userId=${userId}`);
  
  try {
    socket.value = new WebSocket(`${WS_URL}?userId=${userId}`);
    
    // 连接超时处理
    const connectTimeout = setTimeout(() => {
      if (socket.value.readyState === WebSocket.CONNECTING) {
        console.error('⏱️ 连接超时，关闭连接');
        socket.value.close();
      }
    }, 10000); // 10秒超时
    
    socket.value.onopen = () => {
      clearTimeout(connectTimeout);
      console.log('✅ WebSocket 连接成功');
      reconnectAttempts = 0; // 重置重连计数器
      
      // 发送连接消息
      socket.value.send(JSON.stringify({
        type: 'connect',
        userId
      }));
      
      // 心跳机制
      heartbeatInterval = setInterval(() => {
        if (socket.value.readyState === WebSocket.OPEN) {
          socket.value.send(JSON.stringify({ type: 'ping' }));
          console.log('❤️ 发送心跳');
        }
      }, 25000); // 25秒心跳间隔
    };
    
    socket.value.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      // 处理状态更新
      if (data.type === 'status-update') {
        const friend = friends.value.find(f => f._id === data.userId);
        if (friend) {
          friend.isOnline = data.status;
          console.log(`🟢 好友状态更新: ${friend.username} ${data.status ? '在线' : '离线'}`);
        }
        return;
      }
      
      // 处理消息
      if (['text', 'image', 'audio'].includes(data.type)) {
        messages.value.push({
          ...data,
          timestamp: new Date(data.timestamp)
        });
        console.log(`✉️ 收到消息: ${data.content.substring(0, 20)}...`);
      }
      
      // 处理心跳响应
      if (data.type === 'pong') {
        console.log('❤️ 收到心跳响应');
      }
    };
    
    socket.value.onerror = (error) => {
      console.error('❌ WebSocket 错误:', error);
      clearTimeout(connectTimeout);
    };
    
    socket.value.onclose = (event) => {
      clearTimeout(connectTimeout);
      clearInterval(heartbeatInterval);
      console.log(`🚪 连接关闭 (代码: ${event.code}, 原因: ${event.reason || '未知'})`);
      
      // 指数退避重连策略
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        const delay = Math.min(RECONNECT_DELAY_BASE * Math.pow(2, reconnectAttempts), 30000);
        reconnectAttempts++;
        console.log(`⏳ ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} 将在 ${delay}ms 后重连...`);
        
        setTimeout(() => {
          connectWebSocket(userId);
        }, delay);
      } else {
        console.error('🚫 达到最大重连次数，停止尝试');
      }
    };
  } catch (error) {
    console.error('❌ 创建 WebSocket 失败:', error);
  }
};

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