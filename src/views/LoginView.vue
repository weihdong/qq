<template>
    <div class="login-container">
      <br>
      <div class="input-group">
        <input
          v-model="username"
          placeholder="👁️用户名"
          class="input-field"
          @keyup.enter="login"
        />
        <input
          v-model="password"
          type="password"
          placeholder="👁️密码"
          class="input-field"
          @keyup.enter="login"
        />
      </div>
      <br>
      <button @click="login" class="login-btn">进入聊天</button>
      <h1 class="title">🍊OO</h1>
      <h1 class="title t1">永不膨胀的安全聊天</h1>
      <br>
      <br>
      <h5>orange orange chat v5.0.1</h5>

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
  max-width: 400px;
  margin: 50px auto;
  padding: 0rem;
  background: rgba(255, 245, 230, 0.8); /* 设置半透明的背景颜色 */
  border-radius: 58px;
  box-shadow: 0 4px 6px rgba(255, 107, 53, 0.1);
  text-align: center;

  /* 背景模糊效果 */
  backdrop-filter: blur(10px);  /* 设置背景模糊程度 */
  -webkit-backdrop-filter: blur(10px); /* 为Safari浏览器设置 */
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
    margin-bottom: 0 auto 2rem auto; 
    gap: 20px;
    
  }
  
  .input-field {
    width: 60%;
    max-width: 120px;
    padding: 6px;
    margin: 20px 0;
    border: 0px solid #FFD6B3;
    border-radius: 70% 70% 50% 50%;  /* 使得上边形成弯曲的效果 */
    font-size: 1rem;  /* 减小字体 */
    color: #bbbbbb;  /* 更淡的字体颜色 */
    outline: none;
    transition: all 0.3s;
  }
  .input-field::placeholder {
  color: #e7e3e3;  /* 更淡的颜色 */
  font-size: 1rem;  /* 更小的字体 */
}
  .input-field:first-child {
  margin-right: 20px; /* 给第一个输入框增加右边距 */
}
  .input-field:focus {
    border-color: #FF6B35;
    box-shadow: 0 0 8px rgba(255, 107, 53, 0.3);
  }
  
  .login-btn {
  width: 60%;
  padding: 12px;
  background: #FF6B35;
  color: white;
  border: none;
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.3s;
  
  /* 上边缘弯曲 */
  border-radius: 18% 18% 90% 50%;  /* 使得上边形成弯曲的效果 */
  position: relative;
  
  /* 设置按钮高度 */
  height: 50px;
  line-height: 50px; /* 垂直居中 */
}





  .login-btn:hover {
    background: #FF844B;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3);
  }
  
  .login-btn:active {
    transform: translateY(0);
  }

  /* 为整个页面设置背景图片 */
body, html {
  height: 100%; /* 确保背景覆盖整个页面 */
  margin: 0; /* 去掉默认的外边距 */
  padding: 0; /* 去掉默认的内边距 */
  
  background-image: url('./png/bk.jpg'); /* 设置背景图片 */
  background-size: cover; /* 图片覆盖整个页面 */
  background-position: center; /* 图片居中 */
  background-repeat: no-repeat; /* 防止背景图片重复 */
}

  </style>
