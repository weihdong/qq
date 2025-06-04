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
      <h5>orange orange chat v2.12</h5>

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
  const getBaseURL = () => import.meta.env.VITE_API_BASE_URL
  
  const login = async () => {
  try {
    // 输入验证增强
    const trimmedUsername = username.value.trim()
    const trimmedPassword = password.value.trim()
    if (!trimmedUsername || !trimmedPassword) {
      return alert('用户名和密码不能为空')
    }

    // 使用环境变量替代动态判断
    const apiUrl = `${import.meta.env.VITE_API_BASE_URL}/api/login`

    const response = await axios.post(
      apiUrl,
      {
        username: trimmedUsername,
        password: trimmedPassword
      },
      {
        // 合并配置项
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000, // 调整为10秒（更合理的超时时间）
        validateStatus: (status) => status < 500 // 接受500以下的状态码
      }
    )

    // 安全存储（建议后续改用更安全的存储方式）
    if (response.data?.userId) {
      localStorage.setItem('userId', response.data.userId)
      localStorage.setItem('username', trimmedUsername)
      router.push('/chat')
    } else {
      throw new Error('无效的服务器响应')
    }

  } catch (error) {
    // 增强错误处理
    const errorMessage = axios.isCancel(error) 
      ? '请求超时，请检查网络连接'
      : error.response?.data?.error 
        ? `服务器错误：${error.response.data.error}`
        : error.request
          ? '无法连接到服务器'
          : '发生未知错误'

    console.error('[登录失败]', {
      error,
      input: { username: username.value, password: '***' },
      time: new Date().toISOString()
    })
    
    alert(`登录失败：${errorMessage}`)
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
    width: 80%;
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
