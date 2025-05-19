<template>
    <div class="login-container">
      <div class="input-group">
        <input
          v-model="username"
          placeholder="输入用户名"
          class="input-field"
          @keyup.enter="login"
        />
        <input
          v-model="password"
          type="password"
          placeholder="输入密码"
          class="input-field"
          @keyup.enter="login"
        />
      </div>
      <button @click="login" class="login-btn">进入聊天</button>
      <h1 class="title">🍊OO</h1>
      <h1 class="title t1">永不膨胀的安全聊天</h1>
      <h5>orange orange chat v1.01</h5>

    </div>
  </template>
  
  <script setup>
  import { ref } from 'vue'
  import { useRouter } from 'vue-router'
  import axios from 'axios'
  
  const router = useRouter()
  const username = ref('')
  const password = ref('')
  
  // 动态判断接口地址
  const getBaseURL = () => {
    const isProduction = window.location.hostname.includes('085410.xyz')
    return isProduction 
      ? 'https://qq-backend-production.up.railway.app'
      : 'http://localhost:3000'
  }
  
  const login = async () => {
    try {
      // 基础验证
      if (!username.value.trim() || !password.value.trim()) {
        alert('用户名和密码不能为空')
        return
      }
  
      const response = await axios.post(
        `${getBaseURL()}/api/login`,
        {
          username: username.value,
          password: password.value
        },
        {
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'  // 新增此行
    },
    withCredentials: true  // 强制携带凭证
        },
        {
          timeout: 20000 // 5秒超时
        }
      )
  
      // 存储用户信息
      localStorage.setItem('userId', response.data.userId)
      localStorage.setItem('username', username.value)
      
      // 跳转到聊天界面
      router.push('/chat')
      
    } catch (error) {
      let errorMessage = '登录失败，请检查网络连接'
      
      if (error.response) {
        // 服务器返回的错误
        errorMessage = error.response.data?.error || `服务器错误 (${error.response.status})`
      } else if (error.request) {
        // 请求已发出但没有响应
        errorMessage = '无法连接到服务器'
      } else {
        // 其他错误
        errorMessage = error.message
      }
      
      alert(errorMessage)
      console.error('登录错误详情:', error)
    }
  }
  </script>
  
<style scoped>
  .login-container {
    max-width: 70%;
    margin: 50px auto;
    padding: 0rem;
    background: #FFF5E6;
    border-radius: 58px;
    box-shadow: 0 4px 6px rgba(255, 107, 53, 0.1);
    text-align: center;
  }
  
  .title {
    color: #FF6B35;
    font-size: 4.5rem;
    margin-bottom: 2rem;
    text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
  }
  .title.t1{
    font-size: 2rem;
  }
  
  .input-group {
    margin-bottom: 2rem;
  }
  
  .input-field {
    width: 60%;
    padding: 12px;
    margin: 20px 0;
    border: 0px solid #FFD6B3;
    border-radius: 30px;
    font-size: 1rem;
    outline: none;
    transition: all 0.3s;
  }
  
  .input-field:focus {
    border-color: #FF6B35;
    box-shadow: 0 0 8px rgba(255, 107, 53, 0.3);
  }
  
  .login-btn {
    width: 70%;
    padding: 12px;
    background: #FF6B35;
    color: white;
    border: none;
    border-radius: 30px;
    font-size: 1.1rem;
    cursor: pointer;
    transition: all 0.3s;
  }
  
  .login-btn:hover {
    background: #FF844B;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3);
  }
  
  .login-btn:active {
    transform: translateY(0);
  }
  </style>
