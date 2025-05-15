<template>
  <div class="container">
    <!-- 登录界面 -->
    <div v-if="!currentUser" class="login-box">
      <h2>QQ</h2>
      <input v-model="loginForm.username" placeholder="用户名">
      <input v-model="loginForm.password" type="password" placeholder="密码">
      <button @click="handleLogin">登录&自动注册</button>
      <p class="error" v-if="errorMsg">{{ errorMsg }}</p>
    </div>

    <!-- 主界面 -->
    <div v-else class="main-ui">
      <!-- 好友列表 -->
      <div class="friends-panel">
        <div class="header">
          <h3>{{ currentUser }} 的好友</h3>
          <div class="add-friend">
            <input v-model="newFriend" placeholder="输入用户名">
            <button @click="addFriend">添加</button>
          </div>
        </div>
        <ul>
          <li 
            v-for="friend in friends" 
            :key="friend"
            @click="selectFriend(friend)"
            :class="{ active: selectedFriend === friend }"
          >
            {{ friend }}
          </li>
        </ul>
      </div>

      <!-- 聊天窗口 -->
      <div class="chat-panel">
        <div v-if="selectedFriend" class="chat-window">
          <div class="messages">
            <div 
              v-for="(msg, index) in messages" 
              :key="index"
              :class="msg.from === currentUser ? 'sent' : 'received'"
            >
              <span class="time">{{ msg.time }}</span>
              <div class="bubble">{{ msg.text }}</div>
            </div>
          </div>
          <div class="input-area">
            <input 
              v-model="newMessage" 
              @keyup.enter="sendMessage"
              placeholder="输入消息..."
            >
            <button @click="sendMessage">发送</button>
          </div>
        </div>
        <div v-else class="empty-chat">
          请从左侧选择好友开始聊天
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      loginForm: { username: '', password: '' },
      currentUser: null,
      newFriend: '',
      friends: [],
      selectedFriend: null,
      newMessage: '',
      messages: [],
      errorMsg: '',
      ws: null
    }
  },
  methods: {
    async handleLogin() {
      this.errorMsg = '';
      
      if (!this.loginForm.username || !this.loginForm.password) {
        this.errorMsg = '用户名和密码必填';
        return;
      }

      try {
        const response = await fetch('https://qq-backend-production.up.railway.app/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.loginForm)
        });

        const data = await response.json();
        
        if (!response.ok) {
          this.errorMsg = data.error || '登录失败';
          return;
        }

        this.currentUser = this.loginForm.username;
        this.connectWebSocket();
        
      } catch (err) {
        this.errorMsg = '无法连接服务器';
      }
    },

    connectWebSocket() {
      this.ws = new WebSocket('wss://qq-backend-production.up.railway.app');

      this.ws.onopen = () => {
        this.ws.send(JSON.stringify({
          type: 'login',
          username: this.currentUser
        }));
      };

      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'friends':
            this.friends = msg.list;
            break;
          case 'message':
            this.messages.push({
              ...msg,
              time: new Date().toLocaleTimeString()
            });
            break;
        }
      };
    },

    addFriend() {
      if (this.newFriend) {
        this.ws.send(JSON.stringify({
          type: 'add_friend',
          friend: this.newFriend
        }));
        this.newFriend = '';
      }
    },

    selectFriend(friend) {
      this.selectedFriend = friend;
      this.messages = [];
    },

    sendMessage() {
      if (this.newMessage.trim() && this.selectedFriend) {
        this.ws.send(JSON.stringify({
          type: 'message',
          to: this.selectedFriend,
          text: this.newMessage
        }));
        
        this.messages.push({
          from: this.currentUser,
          text: this.newMessage,
          time: new Date().toLocaleTimeString()
        });
        
        this.newMessage = '';
      }
    }
  }
}
</script>

<style scoped>
.container {
  height: 100vh;
  display: flex;
  background: #f5f5f5;
}

.login-box {
  width: 300px;
  margin: auto;
  padding: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  text-align: center;
}

.login-box input {
  width: 100%;
  margin: 10px 0;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.login-box button {
  width: 100%;
  padding: 10px;
  background: #42b983;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.3s;
}

.login-box button:hover {
  background: #3aa876;
}

.error {
  color: #ff4444;
  font-size: 0.9em;
  margin-top: 10px;
}

.main-ui {
  display: flex;
  width: 100%;
  height: 100vh;
}

.friends-panel {
  width: 250px;
  border-right: 1px solid #ddd;
  background: white;
  overflow-y: auto;
}

.header {
  padding: 15px;
  border-bottom: 1px solid #eee;
}

.add-friend {
  display: flex;
  gap: 5px;
  margin-top: 10px;
}

.add-friend input {
  flex: 1;
  padding: 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.add-friend button {
  padding: 6px 12px;
  background: #42b983;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

li {
  padding: 12px 15px;
  cursor: pointer;
  transition: background 0.2s;
}

li:hover {
  background: #f8f8f8;
}

li.active {
  background: #f0f0f0;
}

.chat-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.chat-window {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: #fafafa;
}

.sent {
  display: flex;
  justify-content: flex-end;
  margin: 10px 0;
}

.received {
  display: flex;
  justify-content: flex-start;
  margin: 10px 0;
}

.bubble {
  max-width: 70%;
  padding: 10px 15px;
  border-radius: 15px;
  background: white;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.sent .bubble {
  background: #42b983;
  color: white;
}

.time {
  font-size: 0.8em;
  color: #666;
  margin: 0 10px;
}

.input-area {
  display: flex;
  gap: 10px;
  padding: 15px;
  border-top: 1px solid #eee;
  background: white;
}

.input-area input {
  flex: 1;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 20px;
}

.input-area button {
  padding: 10px 20px;
  background: #42b983;
  color: white;
  border: none;
  border-radius: 20px;
  cursor: pointer;
}

.empty-chat {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  font-size: 1.2em;
}
</style>
