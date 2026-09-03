<script setup>
import { onMounted, ref } from 'vue'

import belugaPair from '@/assets/beluga-pair.png'

import { enablePushNotifications, getNotificationStatus } from '@/utils/pushNotifications'

const notificationStatus = ref('loading')

const notificationMessage = ref('')

const notificationLoading = ref(false)

async function checkNotificationStatus() {
  try {
    notificationStatus.value = await getNotificationStatus()
  } catch {
    notificationStatus.value = 'disabled'
  }
}

async function enableNotifications() {
  notificationLoading.value = true

  notificationMessage.value = ''

  try {
    await enablePushNotifications()

    notificationStatus.value = 'enabled'

    notificationMessage.value = '알림을 받을 수 있어요 🔔'
  } catch (error) {
    console.error(error)

    notificationMessage.value = error.message || '알림 설정에 실패했어요.'

    await checkNotificationStatus()
  } finally {
    notificationLoading.value = false
  }
}

onMounted(() => {
  checkNotificationStatus()
})
</script>

<template>
  <div class="app">
    <header class="app-header">
      <RouterLink to="/" class="title-link">
        <div class="brand-title">
          <img :src="belugaPair" alt="벨루가 두 마리" class="brand-icon" />

          <h1>벨루가네</h1>
        </div>
      </RouterLink>

      <div class="notification-area">
        <button
          v-if="notificationStatus === 'disabled' || notificationStatus === 'denied'"
          class="notification-button"
          :disabled="notificationLoading || notificationStatus === 'denied'"
          @click="enableNotifications"
        >
          {{
            notificationLoading
              ? '설정 중...'
              : notificationStatus === 'denied'
                ? '🔕 알림 차단됨'
                : '🔔 알림 받기'
          }}
        </button>

        <div v-else-if="notificationStatus === 'enabled'" class="notification-enabled">
          🔔 알림 켜짐
        </div>

        <div v-else-if="notificationStatus === 'unsupported'" class="notification-unsupported">
          이 환경에서는 알림을 사용할 수 없어요
        </div>

        <p v-if="notificationMessage" class="notification-message">
          {{ notificationMessage }}
        </p>
      </div>

      <nav class="main-navigation">
        <RouterLink to="/meal"> 밥 </RouterLink>

        <RouterLink to="/bus"> 버스 </RouterLink>

        <RouterLink to="/commute"> 출퇴근 </RouterLink>

        <RouterLink to="/tennis"> 테니스 </RouterLink>

        <RouterLink to="/date"> 데이트 </RouterLink>

        <RouterLink to="/housework"> 집안일 </RouterLink>
      </nav>
    </header>

    <main class="app-content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  background: #f8f4fb;
}

.app-header {
  padding: 20px;
  border-bottom: 1px solid #e9dfef;
  background: white;
}

.title-link {
  display: block;
  width: fit-content;
  margin: 0 auto 12px;
  color: inherit;
  text-decoration: none;
}

.brand-title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.brand-icon {
  width: 58px;
  height: 58px;
  flex-shrink: 0;
  object-fit: contain;
}

h1 {
  margin: 0;
  color: #493957;
  font-size: 24px;
  line-height: 1.2;
  text-align: center;
}

.notification-area {
  min-height: 32px;
  margin: 0 auto 14px;
  text-align: center;
}

.notification-button {
  padding: 7px 13px;
  border: 1px solid #ddcde7;
  border-radius: 999px;
  background: #faf6fc;
  color: #624d70;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.notification-button:disabled {
  cursor: default;
  opacity: 0.65;
}

.notification-enabled {
  display: inline-block;
  padding: 7px 13px;
  border-radius: 999px;
  background: #f2e9f7;
  color: #624d70;
  font-size: 12px;
  font-weight: 700;
}

.notification-unsupported {
  color: #8b7d93;
  font-size: 11px;
}

.notification-message {
  margin: 6px 0 0;
  color: #8b7d93;
  font-size: 11px;
}

.main-navigation {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
  max-width: 900px;
  margin: 0 auto;
}

.main-navigation a {
  padding: 12px;
  border-radius: 14px;
  color: #6d6173;
  text-align: center;
  text-decoration: none;

  transition:
    background 0.2s ease,
    color 0.2s ease;
}

.main-navigation a:hover {
  background: #f2e9f7;
}

.main-navigation a.router-link-active {
  background: #e8d7f3;
  color: #503363;
  font-weight: 700;
}

.app-content {
  width: min(100% - 24px, 900px);
  margin: 0 auto;
  padding: 28px 0 60px;
}

@media (max-width: 640px) {
  .app-header {
    padding: 16px 14px;
  }

  .title-link {
    margin-bottom: 10px;
  }

  .brand-title {
    gap: 8px;
  }

  .brand-icon {
    width: 46px;
    height: 46px;
  }

  h1 {
    font-size: 22px;
  }

  .notification-area {
    margin-bottom: 12px;
  }

  .main-navigation {
    grid-template-columns: repeat(2, 1fr);
  }

  .main-navigation a {
    padding: 10px 8px;
    font-size: 14px;
  }

  .app-content {
    width: min(100% - 20px, 900px);
    padding-top: 22px;
  }
}
</style>
