<template>
  <div class="container">
    <!-- 顶栏 -->
    <div class="header">
      <div class="header-scroll-container"></div>
      <div class="avatar-circle exit-btn" @click="logout"><img src="./png/out1.png" alt="退出"></div>
      <div class="avatar-circle add-btn" @click="toggleAddFriend"><img src="./png/add.png" alt="添加"></div>
      
      <!-- 好友列表 -->
      <!-- 修改头像模板 -->
      <div 
          v-for="friend in store.friends"
          :key="friend._id"
          class="avatar-circle"
          :data-username="friend.username"
          :class="{ 
              online: friend.isOnline,
              active: store.currentChat === friend._id
          }" 
          @click="selectFriend(friend._id)"
      >
          {{ friend.username[0].toUpperCase() }}
          <!-- 在线状态指示器 -->
          <div class="status-dot"></div>
      </div>
          <!-- 群聊列表 -->
      <div 
          v-for="group in store.groups"
          :key="group._id"
          class="avatar-circle group-avatar"
          :class="{ 
              active: store.currentChat === group._id && store.currentChatType === 'group'
          }" 
          @click="selectGroup(group._id)"
      >
          {{ group.code }}
          <div class="group-indicator">{{ group.members.length}}</div>
      </div>
    </div>

    <!-- 添加好友弹窗 -->
    <div v-if="showAddFriendModal" class="modal-mask">
      <div class="modal">
          <div class="modal-tabs">
            <button :class="['tab-btn', { active: activeTab === 'friend' }]" @click="activeTab = 'friend'">好友</button>
            <button :class="['tab-btn', { active: activeTab === 'group' }]" @click="activeTab = 'group'">群聊</button>
          </div>
          
          <!-- 添加好友 -->
          <div v-if="activeTab === 'friend'">
            <input 
              v-model="newFriendName" 
              placeholder="输入用户名"
              class="modal-input"
            >
            <div class="modal-actions">
              <button class="modal-btn confirm-btn" @click="addFriend">添加</button>
              <button class="modal-btn cancel-btn" @click="toggleAddFriend">取消</button>
            </div>
          </div>
          
          <!-- 群聊功能 -->
          <div v-if="activeTab === 'group'">
            <button class="modal-btn create-group-btn" @click="createGroup">创建群聊</button>
            <div class="group-join">
              <input 
                v-model="groupCodeToJoin" 
                placeholder="输入群号"
                class="modal-input"
              >
              <button class="modal-btn join-group-btn" @click="joinGroup">加入群聊</button>
            </div>
            <button class="modal-btn cancel-btn" @click="toggleAddFriend">取消</button>
          </div>
      </div>
    </div>

    <!-- 聊天区域 -->
    <div class="chat-area" ref="chatArea">
      <!-- 群聊标题 -->
      <div v-if="currentGroup" class="group-title">
        <h3>{{ currentGroup.name }}</h3>
        <p>群号: {{ currentGroup.code }}</p>
        <p>成员: {{ currentGroup.members.length }}人</p>
      </div>
      
      <div 
        v-for="msg in store.messages"
        :key="msg._id"
        :class="['message-container', { 'own-message': msg.from === userId }]"
      >
        <!-- 群聊显示发送者名字 -->
        <div class="message-sender" v-if="msg.chatType === 'group'" style="display: inline-block;">
          {{ getSenderName(msg.from) }}
        </div>

        <div class="message-time" style="display: inline-block;">
          {{ formatTime(msg.timestamp) }}
        </div>

        
        <!-- 消息内容... -->
        <!-- 文本消息 -->
        <div v-if="msg.type === 'text'" class="message-bubble">
          <div class="message-content">{{ msg.content }}</div>
        </div>
        
        <!-- 表情消息 -->
        <div v-if="msg.type === 'emoji'" class="emoji-message">
          <img :src="msg.content" class="emoji-img" alt="表情">
        </div>
        
        <!-- 图片消息 -->
        <div v-if="msg.type === 'image'" class="image-message">
          <img :src="msg.fileUrl" class="image-preview" @click="openImage(msg.fileUrl)">
        </div>
        
        <!-- 语音消息 -->
        <div v-if="msg.type === 'audio'" class="audio-message">
          <audio controls :src="msg.fileUrl" class="audio-player"></audio>
          <div class="audio-duration">{{ formatDuration(msg.content) }}</div>
        </div>
      </div>
    </div>


    <!-- 底栏修改 -->
    <div class="footer">
      <!-- 消息输入框 -->
      <input
        v-model="newMessage"
        @keyup.enter="sendTextMessage"
        :placeholder="currentPlaceholder"
        ref="messageInput"
      >

      <!-- 表情按钮 -->
      <button class="emoji-btn" @click="toggleEmojiPicker"><img src="./png/emoji.png" alt="表情"></button>

      <!-- 图片上传按钮 -->
      <button class="file-btn" @click="triggerFileUpload">
        <input 
          type="file" 
          ref="fileInput" 
          accept="image/*" 
          @change="handleImageUpload"
          style="display: none"
        >
        <img src="./png/image.png" alt="图片">
      </button>
      
      <!-- 语音录制按钮 -->
      <button 
        class="voice-btn"
        @mousedown="startRecording"
        @mouseup="stopRecording"
        @touchstart="startRecording"
        @touchend="stopRecording"
      >
      <img src="./png/mic.png" alt="语音">
      </button>
      

      <!-- 新增视频通话按钮 -->
      <button 
        class="videobtn"
        @click="startVideoCall"
      >
        <img src="./png/video.png" alt="视频通话">
      </button>

      <!-- 发送按钮 -->
      <button class="fs" @click="sendTextMessage"><img src="./png/send.png" alt="发送"></button>
    </div>
    
    <!-- 表情选择器 -->
    <div v-if="showEmojiPicker" class="emoji-picker">
      <div 
        v-for="(emoji, index) in emojis" 
        :key="index"
        @click="selectEmoji(emoji)"
      >
        <img :src="emoji.url" class="emoji-option">
      </div>
    </div>
    
    <!-- 新增视频通话模态框 -->
    <div v-if="videoCallModal" class="video-modal">
      <div class="video-container" ref="fullscreenContainer">
        <!-- 本地视频流 -->
        <video ref="localVideo" autoplay muted playsinline @error="handleVideoError('local')"></video>
        
        <!-- 远程视频流 -->
        <video ref="remoteVideo" autoplay playsinline @error="handleVideoError('remote')"></video>
        
        <!-- 控制按钮 -->
        <!-- 新增两个按钮的模板部分 -->
        <div class="video-controls">
          <button class="video-btn end-call" @click="endVideoCall">
            <img src="./png/end-call.png" alt="结束通话">
          </button>
          <button class="video-btn toggle-camera" @click="toggleCamera">
            <img :src='cameraEnabled ? "./png/camera-on.png" : "./png/camera-off.png"' alt="切换摄像头">
          </button>
          <button class="video-btn toggle-mic" @click="toggleMicrophone">
            <img :src="micEnabled ? './png/mic-on.png' : './png/mic-off.png'" alt="切换麦克风">
          </button>
          <!-- 新增切换前置后置摄像头按钮 -->
          <button class="video-btn toggle-facing" @click="toggleCameraFacing">
            <img src="./png/switch-camera.png" alt="切换摄像头方向">
          </button>
          <!-- 新增投屏按钮 -->
          <button class="video-btn screen-share" @click="toggleScreenShare">
            <img :src='isScreenSharing ? "./png/screen-share-active.png" : "./png/screen-share.png"' alt="投屏">
          </button>
                <!-- 修改全屏按钮 -->
          <button class="video-btn fullscreen-btn" @click="toggleFullscreen">
            <img :src="isFullscreen ? '/png/fullscreen-exit.png' : '/png/fullscreen.png'" alt="全屏">
          </button>
        </div>
      </div>
          <!-- 新增：屏幕比例指示器 -->
      <div v-if="showAspectRatio" class="aspect-ratio-indicator">
        屏幕比例: {{ aspectRatio }}
      </div>
      <!-- 在视频模态框中添加状态提示 -->
      <div class="video-status" v-if="connectionState">
        连接状态: {{ connectionState }}
      </div>
    </div>
    
    
    <!-- 图片预览模态框 -->
    <div v-if="previewImage" class="image-preview-modal" @click="previewImage = null">
      <img :src="previewImage" class="full-image">
    </div>
    
    <!-- 录音指示器 -->
    <div v-if="isRecording" class="recording-overlay">
      <div class="recording-indicator">
        <div class="pulse"></div>
        <div class="text">录制中... {{ recordingDuration }}秒</div>
        <button class="cancel-btn" @click="cancelRecording">完成</button>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '@/store/chatStore'
import axios from 'axios'


const router = useRouter()
const store = useChatStore()
const newMessage = ref('')
const userId = localStorage.getItem('userId')
const chatArea = ref(null)
// 新增状态变量
const showAddFriendModal = ref(false)
const activeTab = ref('friend') // 'friend' 或 'group'
const groupCodeToJoin = ref('')

const newFriendName = ref('')
// 新增视频通话相关变量
const videoCallModal = ref(false)
const localVideo = ref(null)
const remoteVideo = ref(null)
const localStream = ref(null)
const peerConnection = ref(null)
const cameraEnabled = ref(true)
const micEnabled = ref(true)
// 新增状态变量
const facingMode = ref('user') // 'user' 前置摄像头, 'environment' 后置摄像头
const isScreenSharing = ref(false)
const screenStream = ref(null)




// 新增状态变量
const isFullscreen = ref(false);
const aspectRatio = ref('16:9');
const showAspectRatio = ref(false);
const fullscreenContainer = ref(null);
// 创建群聊
const createGroup = async () => {
  try {
    const response = await axios.post(`${getBaseURL()}/api/groups`, {
      userId,
      groupName: `群聊${Math.floor(Math.random() * 1000)}`
    })
    
    if (response.data.group) {
      store.groups.push(response.data.group)
      toggleAddFriend()
      alert(`群聊创建成功! 群号: ${response.data.group.code}`)
    }
  } catch (error) {
    console.error('创建群聊失败:', error)
    alert('创建群聊失败: ' + (error.response?.data?.error || error.message))
  }
}

// 加入群聊
const joinGroup = async () => {
  if (!groupCodeToJoin.value.trim()) {
    alert('请输入群号')
    return
  }
  
  try {
    const response = await axios.post(`${getBaseURL()}/api/groups/join`, {
      userId,
      groupCode: groupCodeToJoin.value.trim()
    })
    
    if (response.data.group) {
      store.groups.push(response.data.group)
      toggleAddFriend()
      alert('成功加入群聊!')
    }
  } catch (error) {
    console.error('加入群聊失败:', error)
    alert('加入群聊失败: ' + (error.response?.data?.error || error.message))
  }
}

// 选择群聊
const selectGroup = async (groupId) => {
  // 清除当前消息
  store.clearMessages()
  
  // 设置当前聊天
  store.setCurrentChat(groupId, 'group')
  
  // 加载群聊消息 - 确保在 store 中定义了 loadGroupMessages
  await store.loadGroupMessages(groupId)
}

// 获取发送者名称
const getSenderName = (senderId) => {
  if (senderId === userId) return '我'
  
  // 从好友中查找
  const friend = store.friends.find(f => f._id === senderId)
  if (friend) return friend.username
  
  // 从群成员中查找
  if (currentGroup.value) {
    const member = currentGroup.value.members.find(m => m.userId === senderId)
    if (member) return member.username
  }
  
  return '未知用户'
}

// 计算当前群聊
const currentGroup = computed(() => {
  return store.groups.find(g => g._id === store.currentChat)
})

// 真正的全屏切换功能
const toggleFullscreen = () => {
  const container = fullscreenContainer.value;
  
  if (!isFullscreen.value) {
    // 进入全屏
    container.classList.add('fullscreen-active');
    container.requestFullscreen?.().catch(console.error);
  } else {
    // 退出全屏
    container.classList.remove('fullscreen-active');
    document.exitFullscreen?.();
  }
  
  isFullscreen.value = !isFullscreen.value;
  
  // 调整视频布局
  nextTick(() => {
    if (remoteVideo.value && localVideo.value) {
      if (isFullscreen.value) {
        remoteVideo.value.classList.add('fullscreen-video');
        localVideo.value.classList.add('fullscreen-local');
      } else {
        remoteVideo.value.classList.remove('fullscreen-video');
        localVideo.value.classList.remove('fullscreen-local');
      }
    }
  });
};

// 计算对方屏幕比例
const calculateAspectRatio = () => {
  if (!remoteVideo.value || !remoteVideo.value.videoWidth) return;
  
  const width = remoteVideo.value.videoWidth;
  const height = remoteVideo.value.videoHeight;
  
  if (width > 0 && height > 0) {
    // 计算最大公约数
    const gcd = (a, b) => b ? gcd(b, a % b) : a;
    const divisor = gcd(width, height);
    
    aspectRatio.value = `${width / divisor}:${height / divisor}`;
    showAspectRatio.value = true;
    
    // 3秒后隐藏比例指示器
    setTimeout(() => {
      showAspectRatio.value = false;
    }, 3000);
  }
};

// 监听远程视频元数据加载
watch(() => remoteVideo.value?.videoWidth, () => {
  if (isFullscreen.value && remoteVideo.value && remoteVideo.value.readyState > 0) {
    calculateAspectRatio();
  }
});

onMounted(() => {
  document.addEventListener('fullscreenchange', handleFullscreenChange);
});

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', handleFullscreenChange);
});

const handleFullscreenChange = () => {
  if (!document.fullscreenElement) {
    isFullscreen.value = false;
    fullscreenContainer.value?.classList.remove('fullscreen-active');
    
    if (remoteVideo.value) {
      remoteVideo.value.classList.remove('fullscreen-video');
    }
    if (localVideo.value) {
      localVideo.value.classList.remove('fullscreen-local');
    }
  }
};

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', handleFullscreenChange);
  document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
  document.removeEventListener('msfullscreenchange', handleFullscreenChange);
});






// 添加连接状态响应式变量
const connectionState = ref('');
// 生命周期钩子
onBeforeUnmount(() => {
  endVideoCall()
})

const startVideoCall = async () => {
  if (!store.currentChat) {
    alert('请先选择好友');
    return;
  }
  
  try {
    videoCallModal.value = true;
    await nextTick();
    
    // 1. 获取媒体流
    const constraints = { 
      video: true,
      audio: true
    };
    
    localStream.value = await navigator.mediaDevices.getUserMedia(constraints);
    
    // 2. 立即禁用所有轨道（核心修改）
    localStream.value.getTracks().forEach(track => {
      track.enabled = false; // 禁用摄像头和麦克风
    });
    
    // 3. 更新状态变量
    cameraEnabled.value = false;
    micEnabled.value = false;
    
    // 4. 继续后续流程
    createPeerConnection();
    
    // 添加轨道（此时轨道已被禁用）
    localStream.value.getTracks().forEach(track => {
      peerConnection.value.addTrack(track, localStream.value);
    });
    
    // 显示本地视频
    if (localVideo.value) {
      localVideo.value.srcObject = localStream.value;
      localVideo.value.muted = true;
      localVideo.value.play().catch(e => {
        console.error('本地视频播放失败:', e);
        document.body.click();
        setTimeout(() => localVideo.value.play(), 500);
      });
    }
    
    // 创建offer
    const offer = await peerConnection.value.createOffer({
      offerToReceiveVideo: true,
      offerToReceiveAudio: true
    });
    
    await peerConnection.value.setLocalDescription(offer);
    
    // 发送offer
    sendVideoSignal({
      signalType: 'offer',
      sdp: offer.sdp,
      to: store.currentChat
    });
  } catch (error) {
    console.error('启动视频通话失败:', error);
    alert(`视频通话错误: ${error.message}`);
    endVideoCall();
  }
};

// 修改 createPeerConnection 方法（修复轨道处理）
const createPeerConnection = () => {
  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { 
        urls: "turn:openrelay.metered.ca:80",
        username: "openrelayproject",
        credential: "openrelayproject"
      },
      {
        urls: "turn:turn.anyfirewall.com:443?transport=tcp",
        username: "webrtc",
        credential: "webrtc"
      }
    ]
  };
  
  peerConnection.value = new RTCPeerConnection(configuration);
  
  // 修复轨道处理 - 确保正确添加所有轨道
  peerConnection.value.ontrack = (event) => {
    console.log('收到远程轨道:', event.streams.length);
    
    // 处理多流情况
    if (!remoteVideo.value.srcObject && event.streams.length > 0) {
      remoteVideo.value.srcObject = event.streams[0];
      
      // 添加播放错误处理
      remoteVideo.value.onerror = (e) => {
        console.error('远程视频播放错误:', e);
        // 尝试重新设置源
        setTimeout(() => {
          remoteVideo.value.srcObject = event.streams[0];
          remoteVideo.value.play().catch(console.error);
        }, 500);
      };
      
      remoteVideo.value.onloadedmetadata = () => {
        console.log('远程视频元数据加载完成');
        remoteVideo.value.play().catch(e => {
          console.error('播放失败:', e);
          // 尝试强制播放
          document.body.click(); // 解决浏览器自动播放策略
          setTimeout(() => remoteVideo.value.play(), 1000);
        });
      };
    }
  };

  // 增强ICE候选处理
  peerConnection.value.onicecandidate = (event) => {
    if (event.candidate) {
      sendVideoSignal({
        signalType: 'candidate',
        candidate: event.candidate,
        to: store.currentChat
      });
    }
  };

  // 连接状态处理（防止死循环）
  peerConnection.value.onconnectionstatechange = () => {
    const state = peerConnection.value.connectionState;
    console.log('连接状态变化:', state);
    connectionState.value = state;
    
    // 仅在这些状态下结束通话
    if (['disconnected', 'failed', 'closed'].includes(state)) {
      console.log('连接断开，结束通话');
      endVideoCall();
    }
  };

  peerConnection.value.oniceconnectionstatechange = () => {
    const iceState = peerConnection.value.iceConnectionState;
    console.log('ICE连接状态:', iceState);
    
    // 仅在失败时尝试重连
    if (iceState === 'failed') {
      console.log('ICE连接失败，尝试重新协商');
      if (peerConnection.value.signalingState !== 'closed') {
        startVideoCall(); // 重新尝试连接
      }
    }
  };
};

// 修改 sendVideoSignal 方法（统一信号格式）
const sendVideoSignal = (data) => {
  if (!store.ws || store.ws.readyState !== WebSocket.OPEN) return
  
  const signal = {
    type: 'video-signal',
    from: userId,
    ...data
  }
  
  console.log('发送视频信号:', signal)
  store.ws.send(JSON.stringify(signal))
}
const handleVideoError = (type) => {
  console.error(`${type}视频元素错误`);
  nextTick(() => {
    const videoElement = type === 'local' ? localVideo.value : remoteVideo.value;
    if (videoElement && videoElement.srcObject) {
      videoElement.srcObject.getTracks().forEach(track => track.stop());
      videoElement.srcObject = null;
      setTimeout(() => {
        videoElement.srcObject = type === 'local' ? localStream.value : remoteStream.value;
      }, 500);
    }
  })
}

// 处理收到的视频信号
// 修改 handleVideoSignal 方法（修复远程流处理）
const handleVideoSignal = async (signal) => {
  console.log('收到视频信号:', signal);
  
  if (signal.signalType === 'end-call') {
    console.log('收到结束通话信号');
    endVideoCall();
    return;
  }
  
  // 处理通话请求（offer）
  if (signal.signalType === 'offer') {
    try {
      videoCallModal.value = true;
      await nextTick();
      
      // 结束现有通话（如果有）
      if (peerConnection.value) endVideoCall();
      
      createPeerConnection();
      
      // 1. 获取本地媒体流
      localStream.value = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      // 2. 立即禁用所有轨道（接收方也默认关闭）
      localStream.value.getTracks().forEach(track => {
        track.enabled = false; // 禁用摄像头和麦克风
      });
      
      // 3. 更新状态变量
      cameraEnabled.value = false;
      micEnabled.value = false;
      
      // 添加本地轨道（禁用状态）
      localStream.value.getTracks().forEach(track => {
        peerConnection.value.addTrack(track, localStream.value);
      });
      
      // 显示本地视频
      if (localVideo.value) {
        localVideo.value.srcObject = localStream.value;
        localVideo.value.muted = true;
        localVideo.value.play().catch(e => console.error('本地视频播放失败:', e));
      }
      
      // 处理offer
      await peerConnection.value.setRemoteDescription(
        new RTCSessionDescription({ type: 'offer', sdp: signal.sdp })
      );
      
      // 创建answer
      const answer = await peerConnection.value.createAnswer();
      await peerConnection.value.setLocalDescription(answer);
      
      // 发送answer
      sendVideoSignal({
        signalType: 'answer',
        sdp: answer.sdp,
        to: signal.from
      });
    } catch (error) {
      console.error('接受视频通话失败:', error);
      endVideoCall();
    }
    return;
  }
  
  // 处理answer
  if (signal.signalType === 'answer' && peerConnection.value) {
    try {
      await peerConnection.value.setRemoteDescription(
        new RTCSessionDescription({ type: 'answer', sdp: signal.sdp })
      );
    } catch (error) {
      console.error('设置远程描述失败:', error);
    }
    return;
  }
  
  // 处理candidate
  if (signal.signalType === 'candidate' && peerConnection.value) {
    try {
      if (signal.candidate) {
        await peerConnection.value.addIceCandidate(
          new RTCIceCandidate(signal.candidate)
        );
      }
    } catch (error) {
      console.error('添加ICE候选失败:', error);
    }
  }
};
// 修改 endVideoCall 方法（彻底清理资源）
const endVideoCall = () => {
  console.log('结束视频通话');
  
  // 防止重复调用
  if (!peerConnection.value && !localStream.value) return;
  
  // 发送结束信号
  if (store.currentChat && store.ws?.readyState === WebSocket.OPEN) {
    store.ws.send(JSON.stringify({
      type: 'video-signal',
      signalType: 'end-call',
      to: store.currentChat
    }));
  }
  // 清理投屏资源
  if (screenStream.value) {
    screenStream.value.getTracks().forEach(track => track.stop())
    screenStream.value = null
  }
  
  isScreenSharing.value = false
  // 清理资源
  if (peerConnection.value) {
    // 移除所有事件监听器
    peerConnection.value.onicecandidate = null;
    peerConnection.value.ontrack = null;
    peerConnection.value.onnegotiationneeded = null;
    peerConnection.value.onicecandidateerror = null;
    peerConnection.value.onsignalingstatechange = null;
    peerConnection.value.oniceconnectionstatechange = null;
    peerConnection.value.onconnectionstatechange = null;
    
    // 关闭连接
    peerConnection.value.close();
    peerConnection.value = null;
  }
  
  if (localStream.value) {
    localStream.value.getTracks().forEach(track => {
      track.stop(); // 停止所有轨道
      track.enabled = false;
    });
    localStream.value = null;
  }
  
  if (localVideo.value && localVideo.value.srcObject) {
    localVideo.value.srcObject = null;
    localVideo.value.pause();
  }
  
  if (remoteVideo.value && remoteVideo.value.srcObject) {
    remoteVideo.value.srcObject = null;
    remoteVideo.value.pause();
  }
  
  videoCallModal.value = false;
  connectionState.value = '';
};
// 新增切换前置后置摄像头功能
const toggleCameraFacing = async () => {
  try {
    facingMode.value = facingMode.value === 'user' ? 'environment' : 'user'
    
    if (!localStream.value) return
    
    // 停止当前视频轨道
    const videoTrack = localStream.value.getVideoTracks()[0]
    if (videoTrack) videoTrack.stop()
    
    // 获取新摄像头流
    const newStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: facingMode.value },
      audio: micEnabled.value
    })
    
    // 替换本地流中的视频轨道
    const newVideoTrack = newStream.getVideoTracks()[0]
    const sender = peerConnection.value.getSenders().find(
      s => s.track.kind === 'video'
    )
    
    if (sender) {
      await sender.replaceTrack(newVideoTrack)
    }
    
    // 更新本地流
    localStream.value.getVideoTracks().forEach(track => track.stop())
    localStream.value.removeTrack(videoTrack)
    localStream.value.addTrack(newVideoTrack)
    
    // 更新视频元素
    if (localVideo.value) {
      localVideo.value.srcObject = localStream.value
    }
    
    cameraEnabled.value = true
  } catch (error) {
    console.error('切换摄像头失败:', error)
    alert(`无法切换摄像头: ${error.message}`)
  }
}

// 新增投屏功能
const toggleScreenShare = async () => {
  try {
        // 检查浏览器是否支持投屏功能
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      throw new Error('您的浏览器不支持屏幕共享功能');
    }
    if (isScreenSharing.value) {
      // 停止投屏
      screenStream.value.getTracks().forEach(track => track.stop())
      screenStream.value = null
      
      // 恢复摄像头
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingMode.value },
        audio: micEnabled.value
      })
      
      const newVideoTrack = cameraStream.getVideoTracks()[0]
      const sender = peerConnection.value.getSenders().find(
        s => s.track.kind === 'video'
      )
      
      if (sender) {
        await sender.replaceTrack(newVideoTrack)
      }
      
      // 更新本地流
      localStream.value.getVideoTracks().forEach(track => track.stop())
      localStream.value.removeTrack(localStream.value.getVideoTracks()[0])
      localStream.value.addTrack(newVideoTrack)
      
      // 更新视频元素
      if (localVideo.value) {
        localVideo.value.srcObject = localStream.value
      }
      
      isScreenSharing.value = false
      cameraEnabled.value = true
    } else {
      // 开始投屏
      screenStream.value = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      }).catch(err => {
        // 用户取消屏幕共享时不报错
        if (err.name !== 'NotAllowedError') {
          throw err;
        }
        return null;
      });
      
      if (!screenStream.value) return;
      const screenTrack = screenStream.value.getVideoTracks()[0]
      
      // 替换视频轨道
      const sender = peerConnection.value.getSenders().find(
        s => s.track.kind === 'video'
      )
      
      if (sender) {
        await sender.replaceTrack(screenTrack)
      }
      
      // 更新本地流
      localStream.value.getVideoTracks().forEach(track => track.stop())
      localStream.value.removeTrack(localStream.value.getVideoTracks()[0])
      localStream.value.addTrack(screenTrack)
      
      // 更新视频元素
      if (localVideo.value) {
        localVideo.value.srcObject = localStream.value
      }
      
      // 监听投屏结束事件
      screenTrack.onended = () => {
        if (isScreenSharing.value) {
          toggleScreenShare()
        }
      }
      
      isScreenSharing.value = true
      cameraEnabled.value = true
    }
  } catch (error) {
    console.error('投屏失败:', error)
    
    if (error.name !== 'NotAllowedError') {
      alert(`投屏失败: ${error.message}`)
    }
  }
}

// 切换摄像头
const toggleCamera = () => {
  if (!localStream.value) return;
  
  cameraEnabled.value = !cameraEnabled.value;
  const videoTracks = localStream.value.getVideoTracks();
  if (videoTracks.length > 0) {
    videoTracks[0].enabled = cameraEnabled.value;
  }
};

const toggleMicrophone = () => {
  if (!localStream.value) return;
  
  micEnabled.value = !micEnabled.value;
  const audioTracks = localStream.value.getAudioTracks();
  if (audioTracks.length > 0) {
    audioTracks[0].enabled = micEnabled.value;
  }
};

// 新增表情包 - QQ表情
const EMOJI_BASE_URL = 'https://unpkg.com/@waline/emojis@1.2.0/tieba'
const emojis = ref([
  { name: '微笑', url: `${EMOJI_BASE_URL}/tieba_agree.png` },
  { name: '憨笑', url: `${EMOJI_BASE_URL}/tieba_look_down.png` },
  { name: '色', url: `${EMOJI_BASE_URL}/tieba_sunglasses.png` },
  { name: '发呆', url: `${EMOJI_BASE_URL}/tieba_awkward.png` },
  { name: '得意', url: `${EMOJI_BASE_URL}/tieba_sleep.png` }
])

// 新增状态变量
const showEmojiPicker = ref(false)
const fileInput = ref(null)
const previewImage = ref(null)
const isRecording = ref(false)
const mediaRecorder = ref(null)
const audioChunks = ref([])
const recordingDuration = ref(0)
const recordingTimer = ref(null)
const messageInput = ref(null)

// 获取当前时间戳
const getCurrentTime = () => {
  return new Date().toISOString()
}

// 切换表情选择器
const toggleEmojiPicker = () => {
  showEmojiPicker.value = !showEmojiPicker.value
}

// 选择表情
const selectEmoji = (emoji) => {
  sendMessage('emoji', emoji.url)
  showEmojiPicker.value = false
}

// 触发文件上传
const triggerFileUpload = () => {
  fileInput.value.click()
}

// 处理图片上传
const handleImageUpload = async (e) => {
  const file = e.target.files[0]
  if (!file) return
  
  try {
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await axios.post(`${getBaseURL()}/api/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    
    if (response.data.url) {
      sendMessage('image', null, response.data.url)
    }
  } catch (error) {
    console.error('图片上传失败:', error)
    alert('图片上传失败')
  } finally {
    // 重置input
    e.target.value = ''
  }
}

// 打开图片预览
const openImage = (url) => {
  previewImage.value = url
}

// 开始录音
const startRecording = async (e) => {
  if (e.type === 'mousedown' && e.button !== 0) return // 只响应左键
  e.preventDefault()
  
  try {
    audioChunks.value = []
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRecorder.value = new MediaRecorder(stream)
    
    mediaRecorder.value.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.value.push(event.data)
      }
    }
    
    mediaRecorder.value.onstop = async () => {
      stream.getTracks().forEach(track => track.stop())
      
      if (audioChunks.value.length > 0) {
        const audioBlob = new Blob(audioChunks.value, { type: 'audio/webm' })
        await uploadAudio(audioBlob)
      }
    }
    
    mediaRecorder.value.start()
    isRecording.value = true
    recordingDuration.value = 0
    
    // 开始计时
    recordingTimer.value = setInterval(() => {
      recordingDuration.value += 1
      // 最长60秒
      if (recordingDuration.value >= 60) {
        stopRecording()
      }
    }, 1000)
  } catch (error) {
    console.error('录音失败:', error)
    alert('无法访问麦克风，请检查权限设置')
  }
}

// 停止录音
const stopRecording = () => {
  if (mediaRecorder.value && isRecording.value) {
    mediaRecorder.value.stop()
    clearInterval(recordingTimer.value)
    isRecording.value = false
  }
}

// 取消录音
const cancelRecording = () => {
  if (mediaRecorder.value) {
    mediaRecorder.value.stop()
  }
  clearInterval(recordingTimer.value)
  isRecording.value = false
  audioChunks.value = []
}

// 上传音频文件
const uploadAudio = async (audioBlob) => {
  try {
    const formData = new FormData()
    formData.append('file', audioBlob, 'recording.webm')
    
    const response = await axios.post(`${getBaseURL()}/api/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    
    if (response.data.url) {
      sendMessage('audio', recordingDuration.value, response.data.url)
    }
  } catch (error) {
    console.error('音频上传失败:', error)
    alert('音频上传失败')
  }
}

// 格式化录音时长
const formatDuration = (seconds) => {
  return `${seconds}秒`
}
// WebSocket 连接管理
let reconnectAttempts = 0
const MAX_RECONNECT_ATTEMPTS = 5

const getBaseURL = () => {
  return window.location.hostname.includes('085410.xyz') 
    ? 'https://web-production-5fc08.up.railway.app'
    : 'http://localhost:3000'
}

const getWsURL = () => {
  return window.location.hostname.includes('085410.xyz') 
    ? 'wss://web-production-5fc08.up.railway.app'
    : 'ws://localhost:3000'
}

// WebSocket 连接管理（优化重连逻辑）
const connectWebSocket = () => {
  const ws = new WebSocket(getWsURL())
  let heartbeatInterval
  // 在WebSocket连接中处理群聊消息
  const handleGroupMessage = async (message) => {
    // 如果消息属于当前活跃的群聊
    if (store.currentChat === message.to && store.currentChatType === 'group') {
      const newMessage = {
        ...message.data,
        _id: message.data._id,
        from: message.data.from,
        to: message.data.to,
        content: message.data.content,
        type: message.data.type,
        fileUrl: message.data.fileUrl,
        timestamp: new Date(message.data.timestamp),
        chatType: 'group'
      }
      
      store.messages.push(newMessage)
    }
  }


  const sendConnect = () => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'connect',
        userId: localStorage.getItem('userId')
      }))
    }
  }

  ws.onopen = () => {
    console.log('WebSocket连接成功')
    reconnectAttempts = 0
    sendConnect()
    
    // 心跳机制（每25秒发送一次）
    heartbeatInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }))
      }
    }, 25000)
  }

  // 修改后的消息处理逻辑
  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data)
      // 视频信号处理
      if (message.type === 'video-signal') {
        handleVideoSignal(message)
        return
      }
            // 结束通话处理
      if (message.type === 'end-call') {
        console.log('收到结束通话信号')
        endVideoCall()
        return
      }
          // 群聊消息处理
      if (message.type === 'group-message') {
        // 如果当前正在这个群聊中，则添加到消息列表
        if (store.currentChat === message.data.to && store.currentChatType === 'group') {
          const newMessage = {
            ...message.data,
            _id: message.data._id,
            from: message.data.from,
            to: message.data.to,
            content: message.data.content,
            type: message.data.type,
            fileUrl: message.data.fileUrl,
            timestamp: new Date(message.data.timestamp),
            chatType: 'group'
          }
          
          store.messages.push(newMessage)
        }
        
        // 更新群聊未读消息计数
        if (store.currentChat !== message.data.to || store.currentChatType !== 'group') {
          const groupIndex = store.groups.findIndex(g => g._id === message.data.to)
          if (groupIndex !== -1) {
            store.groups[groupIndex].unreadCount = (store.groups[groupIndex].unreadCount || 0) + 1
          }
        }
        return
      }
      // 统一处理所有消息
      if (message.type === 'message') {
        const newMessage = {
          ...message.data,
          _id: message.data._id,
          from: message.data.from,
          to: message.data.to,
          content: message.data.content,
          type: message.data.type,
          fileUrl: message.data.fileUrl,
          timestamp: new Date(message.data.timestamp)
        }
        
        store.messages.push(newMessage)
      }
      // 状态更新消息 (新增处理)
      else if (message.type === 'status') {
        // 找到对应的好友并更新状态
        const friendIndex = store.friends.findIndex(f => f._id === message.userId)
        if (friendIndex !== -1) {
          store.friends[friendIndex].isOnline = message.online
        }
      }

      // 系统消息
      else if (message.type === 'system') {
        console.log('系统消息:', message.message)
      }
    } catch (error) {
      console.error('消息处理错误:', error)
    }
  }

  ws.onclose = (event) => {
    console.log('连接关闭，代码:', event.code, '原因:', event.reason)
    clearInterval(heartbeatInterval)
  
  // 立即尝试重连（指数退避）
  const reconnect = () => {
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      console.log(`尝试第 ${reconnectAttempts + 1} 次重连...`)
      store.ws = connectWebSocket()
      reconnectAttempts++
    }
  }
  
  // 首次立即重连，后续使用延迟
  if (reconnectAttempts === 0) {
    reconnect()
  } else {
    const delay = Math.min(3000 * Math.pow(2, reconnectAttempts), 30000)
    setTimeout(reconnect, delay)
  }
}

  ws.onerror = (error) => {
    console.error('WebSocket错误:', error)
  }

  return ws
}

// 退出登录
const logout = () => {
  localStorage.removeItem('userId')
  localStorage.removeItem('username')
  router.push('/login')
}

// 添加好友功能
const toggleAddFriend = () => {
  showAddFriendModal.value = !showAddFriendModal.value
  newFriendName.value = ''
}

const currentFriend = computed(() => {
  return store.friends.find(f => f._id === store.currentChat)
})

const currentPlaceholder = computed(() => {
  if (!store.currentChat) return '点击头像开始聊天'
  return currentFriend.value
    ? `给 ${currentFriend.value.username} 发送消息`
    : '正在加载用户信息...'
})

// 优化后的添加好友方法
const addFriend = async () => {
try {
  if (!newFriendName.value.trim()) {
    alert('请输入好友用户名');
    return;
  }

  const response = await axios.post(`${getBaseURL()}/api/friends`, {
    userId: localStorage.getItem('userId'),
    friendUsername: newFriendName.value.trim()
  });

  if (response.data?.friendId) {
    // 调用新添加的获取用户信息接口
    const friendInfo = await axios.get(`${getBaseURL()}/api/user/${response.data.friendId}`)
    
    store.friends.push({
      _id: response.data.friendId,
      username: friendInfo.data.username,
      isOnline: false // 此处可以结合WebSocket状态更新
    });
    
    toggleAddFriend();
    alert('添加成功！');
  }
} catch (error) {
  let errorMessage = '添加失败，请重试';
  if (error.response) {
    switch (error.response.data.code) {
      case 'FRIEND_NOT_FOUND':
        errorMessage = '用户不存在';
        break;
      case 'ALREADY_FRIENDS':
        errorMessage = '已是好友关系';
        break;
      case 'SELF_ADDITION':
        errorMessage = '不能添加自己';
        break;
    }
  }
  alert(`错误: ${errorMessage}`);
  console.error('添加好友失败详情:', error.response?.data || error.message);
}
}

// 修改选择好友方法
const selectFriend = async (friendId) => {
  // 清除当前消息
  store.clearMessages()
  
  // 设置当前聊天
  store.setCurrentChat(friendId, 'private')
  
  // 加载新消息
  await store.loadMessages()
}

// 发送消息（增强版）
const sendMessage = (type, content = null, fileUrl = null) => {
  if (!store.currentChat) {
    alert('请先选择聊天对象')
    return
  }
  
  if (type === 'text' && !newMessage.value.trim()) return
  
  if (!store.ws || store.ws.readyState !== WebSocket.OPEN) {
    console.log('连接未就绪，尝试重新发送...')
    store.ws = connectWebSocket()
    setTimeout(() => sendMessage(type, content, fileUrl), 500)
    return
  }
  
  try {
    const message = {
      type,
      from: userId,
      to: store.currentChat,
      content: type === 'text' ? newMessage.value.trim() : content,
      fileUrl,
      timestamp: getCurrentTime(),
      chatType: store.currentChatType // 'private' 或 'group'
    }
    
    store.ws.send(JSON.stringify(message))
    
    // 清空文本输入
    if (type === 'text') {
      newMessage.value = ''
    }
  } catch (error) {
    console.error('发送消息失败:', error)
    alert('消息发送失败，请检查网络连接')
  }
}

// 发送文本消息
const sendTextMessage = () => {
  sendMessage('text')
}

// 时间格式化
const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// 消息自动滚动
watch(() => store.messages, async () => {
  await nextTick()
  if (chatArea.value) {
    chatArea.value.scrollTop = chatArea.value.scrollHeight
  }
}, { deep: true })

// 初始化加载
onMounted(async () => {
  try {
    // 加载好友列表
    const friendsRes = await axios.get(`${getBaseURL()}/api/friends`, {
      params: { userId }
    })
    store.friends = friendsRes.data.friends.map(f => ({
      ...f,
      isOnline: false
    }))

    // 加载群聊列表
    const groupsRes = await axios.get(`${getBaseURL()}/api/groups`, {
      params: { userId }
    })
    store.groups = groupsRes.data.groups
    
    // 建立WebSocket连接
    store.ws = connectWebSocket()
  } catch (error) {
    console.error('初始化失败:', error)
    alert('初始化失败，请刷新页面重试')
  }
})

</script>

<!-- 样式保持不变 -->
<style scoped>
/* 添加状态指示样式 */
.avatar-circle {
position: relative;
overflow: visible;
}

.status-dot {
position: absolute;
bottom: 2px;
right: 2px;
width: 12px;
height: 12px;
border-radius: 50%;
background: #ccc; /* 默认离线状态 */
border: 2px solid white;
transition: all 0.3s ease;
}

.online .status-dot {
background: #4CAF50; /* 在线状态颜色 */
box-shadow: 0 0 8px rgba(76, 175, 80, 0.3);
}

/* 移动端优化 */
@media (max-width: 480px) {
.status-dot {
  width: 10px;
  height: 10px;
  bottom: 1px;
  right: 1px;
}
}
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(255,255,255,0.6);
  backdrop-filter: blur(5px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 999;
}

.modal {
  background: #fff;
  border-radius: 48px;
  padding: 28px;
  width: 68%;
  max-width: 320px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.12);
}

.modal-input {
  width: 100%;
  height: 52px;
  padding: 0 0px;
  border: 2px solid #f0f0f0;
  border-radius: 40px;
  font-size: 16px;
  margin-bottom: 24px;
  background: #fff;
  transition: all 0.2s;
}

.modal-input:focus {
  border-color: orange;
  outline: none;
  box-shadow: 0 0 0 3px rgba(0,122,255,0.1);
}

.modal-actions {
  display: flex;
  gap: 12px;
}

.modal-btn {
  flex: 1;
  height: 52px;
  border: none;
  border-radius: 40px;
  font-size: 17px;
  font-weight: 500;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.confirm-btn {
  background: orange;
  color: white;
  margin-left: -4px; /* 视觉对齐补偿 */
}

.confirm-btn:active {
  background: rgb(168, 109, 0);
  transform: scale(0.96);
}

.cancel-btn {
  background: transparent;
  color: #666;
  border: 2px solid #e3e3e3;
  margin-right: -4px; /* 视觉对齐补偿 */
}

.cancel-btn:active {
  background: #f8f8f8;
  transform: scale(0.96);
}

/* 输入框占位符样式 */
.modal-input::placeholder {
  color: #999;
  font-weight: 300;
  padding: 15px;
}

/* 全局样式重置 */

/* 颜色主题 */
:root {
--primary: #FF6B35;      /* 主橘色 */
--primary-dark: #E85720; /* 深橘色 */
--bg: #FFFFFF;           /* 背景白 */
--text-primary: #2D3748; /* 主要文字 */
--text-secondary: #718096; /* 次要文字 */
--border: #E2E8F0;       /* 边框色 */
}

/* 容器布局 */
.container {
height: 100vh;
display: flex;
flex-direction: column;
background: var(--bg);
overflow: hidden;
}

/* 顶栏 */
.header {
position: fixed;
overflow-x: auto;
-webkit-overflow-scrolling: touch;
cursor: grab;
scrollbar-width: none;
left: 0;
right: 0;
top: 0;
width: 100%;
height: 64px;
background: orange;
display: flex;
align-items: center;
padding: 0 0px;
gap: 12px;
z-index: 1000;
box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
.header-scroll-container{
  display: inline-flex;
  height: 100%;
  align-items: center;
  padding: 0 0.5%;
  gap: 3%;
  flex-shrink: 0;
}

/* 聊天区域 */
.chat-area {
flex: 1;
background-color: white;
overflow-y: auto;
padding: 80px 16px 100px;
display: flex;
flex-direction: column;
}

/* 消息容器 */
.message-container {
position: relative;
max-width: 80%;
margin: 14px 0px;
align-self: flex-start; /* 默认接收消息在左边 */
}

.message-container.own-message {
align-self: flex-end; /* 发送消息在右边 */
margin-right: 0px;
}

/* 时间显示 */
/* 消息时间样式调整 */
.message-time {
position: absolute;
top: -18px;
font-size: 0.7rem;
color: var(--text-secondary);
white-space: nowrap;
/* 默认接收方样式 */
left: 8px;
}
.message-container.own-message .message-time {
/* 发送方调整为右对齐 */
left: auto;
right: 8px;
text-align: right;
}

/* 消息气泡 */
.message-bubble {
padding: 12px 16px;
border-radius: 30px;
background: #F7FAFC;
position: relative;
word-break: break-word;
line-height: 1.4;
box-shadow: 0 2px 4px rgba(0,0,0,0.05);
max-width: 480px; /* 最大宽度限制 */
}

.message-container.own-message .message-bubble {
background: orange;
color: white !important;
border-radius: 20px 4px 20px 20px;
box-shadow: 0 2px 6px rgba(0,0,0,0.1);
}

/* 底栏 */
.footer {
position: fixed;
left: 0;
right: 0;
bottom: 0;
width: 100%;
height: 64px;
background: gainsboro;
display: flex;
gap: 4%;
align-items: center;
padding: 0 0;
border-top: 1px solid var(--border);
}

/* 输入框 */
.footer input {
width: 40%;
height: 48px;
border: 2px solid var(--border);
border-radius: 28px;
padding: 0 20px;
font-size: 16px;
background: white;
transition: all 0.2s;
margin-left: 4.5%;
}

.footer input:focus {
border-color: orange;
box-shadow: 0 0 0 2px orange;
outline: none;
}

/* 发送按钮 */
.footer button {
width: 8%;
height: 48px;
background: gainsboro;
color: rgb(0, 0, 0);
border: none;
border-radius: 0px;
font-weight: 600;
cursor: pointer;
transition: all 0.2s;
margin-right: -0.6%;
}
.footer button:hover {
  background: var(--primary-dark);
}

/* 头像基础样式 */
.avatar-circle {
flex-shrink: 0;
width: 44px;
height: 44px;
border-radius: 50%;
display: flex;
align-items: center;
justify-content: center;
font-weight: 600;
color: var(--primary);
box-shadow: 0 2px 4px rgba(0,0,0,0.1);
transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
position: relative;
z-index: 1;
border: 2px solid transparent;
}

/* 选中状态 */
.avatar-circle.active {
  position: relative;
transform: scale(0.8);
}

.avatar-circle.active::after {
content: "";
position: absolute;
top: -6px;
left: -6px;
right: -6px;
bottom: -6px;
border: 8px solid orange;
border-radius: 50%;
/* box-shadow: 
  0 0 0 2px white,
  0 0 12px rgba(255, 167, 38, 0.5); */
animation: pulse 2.5s infinite;
z-index: -1;
}

@keyframes pulse {
0% { transform: scale(0.9); opacity: 1; }
50% { transform: scale(1.55); opacity: 1; }
100% { transform: scale(0.9); opacity: 1; }
}

/* 随机背景色保持最底层 */
/* 将原有4种扩展到7种 */
.avatar-circle:nth-child(7n+1) { background-color: #fff3e0; } /* 浅橙色 */
.avatar-circle:nth-child(7n+2) { background-color: #f5f6fa; } /* 浅蓝色 */
.avatar-circle:nth-child(7n+3) { background-color: #e8f5e9; } /* 浅绿色 */
.avatar-circle:nth-child(7n+4) { background-color: #f3e5f5; } /* 浅紫色 */
.avatar-circle:nth-child(7n+6) { background-color: #ffeef7; } /* 新增浅粉色 */
.avatar-circle:nth-child(7n+5) { background-color: #feeb8c; } /* 新增浅米色 */
.avatar-circle:nth-child(7n+7) { background-color: #e0f4f3; } /* 新增浅青绿 */

/* 新增样式 */
.emoji-btn, .file-btn, .voice-btn, .videobtn {
  width: 2%;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 260%;
  cursor: pointer;
  background: white;
  border-radius: 50%;
  margin: 0 -11px;
  user-select: none;
}
.fs {
  width: 2%;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 260%;
  cursor: pointer;
  background: #4CAF50;
  border-radius: 50%;
  margin: 0 -11px;
  user-select: none;
}
.emoji-btn:hover, .file-btn:hover, .voice-btn:hover {
  background: #f0f0f0;
}

/* 表情选择器 */
.emoji-picker {
  position: fixed;
  bottom: 80px;
  left: 10px;
  width: 300px;
  height: 200px;
  background: white;
  border-radius: 10px;
  box-shadow: 0 5px 15px rgba(0,0,0,0.1);
  display: flex;
  flex-wrap: wrap;
  overflow-y: auto;
  padding: 10px;
  z-index: 1000;
}

.emoji-option {
  width: 30px;
  height: 30px;
  margin: 5px;
  cursor: pointer;
  transition: transform 0.2s;
}

.emoji-option:hover {
  transform: scale(1.2);
}

/* 消息样式 */
.emoji-message img {
  width: 60px;
  height: 60px;
}

.image-message img {
  max-width: 200px;
  max-height: 200px;
  border-radius: 10px;
  cursor: pointer;
}

.audio-message {
  display: flex;
  align-items: center;
  gap: 10px;
}

.audio-player {
  width: 200px;
}

.audio-duration {
  font-size: 14px;
  color: #666;
}

/* 图片预览模态框 */
.image-preview-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.full-image {
  max-width: 90%;
  max-height: 90%;
}

/* 录音指示器 */
.recording-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
}

.recording-indicator {
  background: white;
  padding: 30px;
  border-radius: 20px;
  text-align: center;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
}

.pulse {
  width: 80px;
  height: 80px;
  background: #ff4d4d;
  border-radius: 50%;
  margin: 0 auto 20px;
  animation: pulse 1.5s infinite;
}


.cancel-btn {
  margin-top: 20px;
  padding: 10px 20px;
  background: #f0f0f0;
  border: none;
  border-radius: 20px;
  cursor: pointer;
}

/* 新增视频通话样式 */
.video-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.9);
  z-index: 2000;
  display: flex;
  justify-content: center;
  align-items: center;
}

.video-container {
  width: 90%;
  max-width: 900px;
  height: 80vh;
  position: relative;
  background: rgb(255, 217, 147);
  border-radius: 40px;
  overflow: hidden;
}

.video-container video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.video-container video:first-child {
  position: absolute;
  width: 30%;
  height: 25%;
  top: 4%;
  right: 4%;
  border-radius: 40px;
  z-index: 10;
  border: 2px solid white;
}

.video-controls {
  position: absolute;
  bottom: 4%;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  margin-left: 5%;
  margin-right: 5%;
  gap: 15px;
  flex-wrap: wrap;
  z-index: 30;
}

.video-btn {
  width: 16%;
  aspect-ratio: 1;
  max-width: 48px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s;
  z-index: 1002;
}

.video-btn img {
  width: 100%;
  height: 100%;
}

.video-btn.end-call {
  background: #ff4d4d;
}
/* 新增图标样式 */
.toggle-facing img, .screen-share img, .toggle-camera img, .toggle-mic img {
  width: 30px;
  height: 30px;
}
/* 活动状态的投屏按钮 */
.screen-share.active {
  background: rgba(76, 175, 80, 0.3);
}
.video-btn:hover {
  transform: scale(1.1);
}
.video-status {
  position: absolute;
  top: 10px;
  left: 10px;
  background: rgba(0,0,0,0.5);
  color: white;
  padding: 5px 10px;
  border-radius: 5px;
  z-index: 100;
}
/* 底栏视频按钮样式 */
.footer .video-btn {
  width: 40px;
  height: 40px;
  background: white;
  border-radius: 50%;
  margin: 0 -11px;
}

.footer .video-btn img {
  width: 24px;
  height: 24px;
}


/* 全屏模式下的容器 */
.video-container.fullscreen-active {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 3000;
  background: #000;
  border-radius: 0;
}

/* 全屏模式下的远程视频 */
.fullscreen-video {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: contain; /* 保持宽高比 */
  z-index: 1;
}

/* 全屏模式下的本地视频小窗口 */
.fullscreen-local {
  position: absolute;
  top: 1px;
  right: 1px;
  width: 8%;
  max-width: 40px;
  z-index: 10;
  border: 2px solid white;
  border-radius: 0px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
}

/* 屏幕比例指示器 */
.aspect-ratio-indicator {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 16px;
  z-index: 20;
  opacity: 0.8;
  transition: opacity 0.5s;
}

/* 新增群聊样式 */
.group-avatar {
  position: relative;
  background-color: #ffcc80; /* 群聊特殊背景色 */
}

.group-indicator {
  position: absolute;
  bottom: -5px;
  right: -5px;
  background: #ff9800;
  color: white;
  font-size: 10px;
  padding: 2px 5px;
  border-radius: 10px;
  border: 1px solid white;
}

.modal-tabs {
  display: flex;
  margin-bottom: 15px;
  border-bottom: 1px solid #eee;
}

.tab-btn {
  flex: 1;
  padding: 10px;
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  cursor: pointer;
}

.tab-btn.active {
  border-bottom-color: orange;
  font-weight: bold;
}

.group-join {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

.group-join input {
  flex: 1;
}

.create-group-btn, .join-group-btn {
  background: #ff9800;
  color: white;
}

.group-title {
  text-align: center;
  padding: 10px;
  background: rgba(255, 152, 0, 0.1);
  margin-bottom: 15px;
  border-radius: 10px;
}

.message-sender {
  font-weight: bold;
  margin-bottom: 4px;
  color: #ff9800;
}
</style>
