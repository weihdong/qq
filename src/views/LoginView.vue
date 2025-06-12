<template>
  <div class="page-container">
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
  .page-container {
    position: relative;
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    /* 静态图片背景 */
    background-image: url('./png/bk.jpg');
    background-size: cover;
    background-position: center center;
    background-repeat: no-repeat;
    animation: moveAndZoom 30s infinite ease-in-out; /* 更平滑的动画时长 */
    z-index: -1; /* 使背景图片在所有内容后面 */
  }
  
  /* 定义背景图片上下移动和缩放的动画 */
  @keyframes moveAndZoom {
    0% {
      background-position: center top; /* 初始位置在顶部 */
      transform: scale(1);             /* 初始缩放比例 */
    }
    25% {
      background-position: center center; /* 移动到中心 */
      transform: scale(1.05);             /* 略微放大 */
    }
    50% {
      background-position: center bottom; /* 移动到底部 */
      transform: scale(1.1);              /* 略微放大 */
    }
    75% {
      background-position: center center; /* 回到中心 */
      transform: scale(1.05);             /* 略微放大 */
    }
    100% {
      background-position: center top;    /* 再次回到顶部 */
      transform: scale(1);                /* 恢复到原始大小 */
    }
  }
  
  .login-container {
  max-width: 460px;
  min-width: 280px;
  width: 58%;
  margin: 0; /* 删除原来的 margin 设置 */
  padding: 2rem; /* 可以根据需要调整 padding */
  background: rgba(255, 245, 230, 0.2); /* 设置半透明的背景颜色 */
  border-radius: 58px;
  box-shadow: 0 4px 6px rgba(255, 107, 53, 0.1);
  text-align: center;

  /* 背景模糊效果 */
  backdrop-filter: blur(15px);  /* 增强背景模糊效果 */
  -webkit-backdrop-filter: blur(15px); /* 为Safari浏览器设置 */
  
  /* 添加渐变效果，模拟玻璃反光 */
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.3) 100%), rgba(255, 245, 230, 0.2);
  
  /* 添加边框模拟液态玻璃反射效果 */
  border: 1px solid rgba(255, 255, 255, 0.2); 

  /* 可选：增加光泽感的伪元素 */
  position: relative;

  /* 动画：玻璃反光丝滑特效 */
  animation: borderGlow 3s ease-in-out infinite;
}

  
  /* 光泽反射动画 */
  @keyframes borderGlow {
    0% {
      border-color: rgba(255, 255, 255, 0.2);
      box-shadow: 0 4px 6px rgba(255, 107, 53, 0.1);
    }
    50% {
      border-color: rgba(255, 255, 255, 0.5);
      box-shadow: 0 4px 8px rgba(255, 255, 255, 0.4);
    }
    100% {
      border-color: rgba(255, 255, 255, 0.2);
      box-shadow: 0 4px 6px rgba(255, 107, 53, 0.1);
    }
  }
  
  .login-container::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 60%;
    height: 30%;
    background: rgba(255, 255, 255, 0.1);  /* 光泽反射效果 */
    border-radius: 50%;
    filter: blur(30px);
    opacity: 0.2;
  
    /* 顺时针光泽反射的动态路径 */
    animation: clockwiseShine 4s infinite ease-in-out;
  }
  
  @keyframes clockwiseShine {
    0% {
      top: 0;
      left: 0;
      opacity: 0.2;
      transform: rotate(0deg);
    }
    25% {
      top: 0;
      left: 50%;
      opacity: 0.3;
      transform: rotate(90deg);
    }
    50% {
      top: 50%;
      left: 50%;
      opacity: 0.4;
      transform: rotate(180deg);
    }
    75% {
      top: 50%;
      left: 100%;
      opacity: 0.3;
      transform: rotate(270deg);
    }
    100% {
      top: 0;
      left: 100%;
      opacity: 0.2;
      transform: rotate(360deg);
    }
  }
  
  .title {
    color: #FF6B35;
    font-size: 4.5rem;
    margin-bottom: 2rem;
    text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
  }
  .title.t1 {
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
  
  </style>