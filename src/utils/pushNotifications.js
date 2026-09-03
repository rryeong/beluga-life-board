import { supabase } from '@/lib/supabase'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)

  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')

  const rawData = window.atob(base64)

  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

function getDeviceId() {
  const key = 'beluga-push-device-id'

  let deviceId = localStorage.getItem(key)

  if (!deviceId) {
    deviceId = crypto.randomUUID()

    localStorage.setItem(key, deviceId)
  }

  return deviceId
}

export async function getNotificationStatus() {
  if (
    !('Notification' in window) ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    return 'unsupported'
  }

  const registration = await navigator.serviceWorker.ready

  const subscription = await registration.pushManager.getSubscription()

  if (Notification.permission === 'granted' && subscription) {
    return 'enabled'
  }

  if (Notification.permission === 'denied') {
    return 'denied'
  }

  return 'disabled'
}

export async function enablePushNotifications() {
  if (
    !('Notification' in window) ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    throw new Error('이 기기에서는 푸시 알림을 사용할 수 없어요.')
  }

  const permission = await Notification.requestPermission()

  if (permission !== 'granted') {
    throw new Error('알림 권한이 허용되지 않았어요.')
  }

  const registration = await navigator.serviceWorker.ready

  let subscription = await registration.pushManager.getSubscription()

  if (!subscription) {
    const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY

    if (!publicKey) {
      throw new Error('VAPID Public Key가 설정되지 않았어요.')
    }

    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })
  }

  const subscriptionJson = subscription.toJSON()

  const deviceId = getDeviceId()

  const { error } = await supabase.rpc('save_push_subscription', {
    p_device_id: deviceId,
    p_endpoint: subscription.endpoint,
    p_subscription: subscriptionJson,
    p_device_name: navigator.platform || 'unknown',
    p_user_agent: navigator.userAgent,
  })

  if (error) {
    console.error('푸시 구독 저장 실패:', error)

    throw new Error(`푸시 구독 저장 실패: ${error.message}`)
  }

  return true
}
