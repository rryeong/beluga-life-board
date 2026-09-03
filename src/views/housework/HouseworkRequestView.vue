<script setup>
import { computed, onMounted, ref } from 'vue'

import { supabase } from '@/lib/supabase'

const title = ref('')
const memo = ref('')
const dueDate = ref('')
const priority = ref('보통')
const photoFile = ref(null)
const photoPreview = ref('')

const requests = ref([])
const rewards = ref([])

const balance = ref(0)

const rewardTitle = ref('')
const rewardEmoji = ref('🎁')
const rewardCost = ref(5)

const loading = ref(false)
const adding = ref(false)
const uploading = ref(false)
const message = ref('')
const isError = ref(false)

/* 요청 수정 */

const editingId = ref(null)
const editTitle = ref('')
const editMemo = ref('')
const editDueDate = ref('')
const editPriority = ref('보통')
const editPhotoFile = ref(null)
const editPhotoPreview = ref('')
const editOriginalPhotoUrl = ref('')
const removeExistingPhoto = ref(false)
const savingEdit = ref(false)

function setMessage(text, error = false) {
  message.value = text
  isError.value = error
}

/* 상태 */

const requestedCount = computed(() => {
  return requests.value.filter((item) => item.status === '요청함').length
})

const doingCount = computed(() => {
  return requests.value.filter((item) => item.status === '하는 중').length
})

const completedCount = computed(() => {
  return requests.value.filter((item) => item.status === '완료').length
})

const activeRequests = computed(() => {
  return requests.value.filter((item) => item.status !== '완료')
})

const completedRequests = computed(() => {
  return requests.value.filter((item) => item.status === '완료')
})

/* 보상 */

const sortedRewards = computed(() => {
  return [...rewards.value].sort((a, b) => a.cost - b.cost)
})

const nextReward = computed(() => {
  return sortedRewards.value.find((reward) => reward.cost > balance.value) ?? null
})

const progressPercent = computed(() => {
  if (!nextReward.value) {
    return balance.value > 0 ? 100 : 0
  }

  const previousCost =
    [...sortedRewards.value]
      .filter((reward) => reward.cost <= balance.value)
      .map((reward) => reward.cost)
      .pop() ?? 0

  const range = nextReward.value.cost - previousCost

  if (range <= 0) {
    return 100
  }

  return Math.min(100, Math.max(0, ((balance.value - previousCost) / range) * 100))
})

function formatDate(dateString) {
  if (!dateString) return ''

  const [year, month, day] = dateString.split('-')

  return `${year}.${month}.${day}`
}

function formatCompletedAt(dateString) {
  if (!dateString) return ''

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString))
}

function priorityClass(value) {
  return value === '급함' ? 'urgent' : 'normal'
}

/* 사진 */

function getStoragePathFromUrl(url) {
  if (!url) return null

  const marker = '/storage/v1/object/public/housework-photos/'

  const index = url.indexOf(marker)

  if (index === -1) {
    return null
  }

  return decodeURIComponent(url.slice(index + marker.length))
}

async function deletePhotoByUrl(url) {
  const path = getStoragePathFromUrl(url)

  if (!path) return

  const { error } = await supabase.storage.from('housework-photos').remove([path])

  if (error) {
    console.warn('기존 사진 삭제 실패:', error)
  }
}

/* 데이터 불러오기 */

async function loadData() {
  loading.value = true
  setMessage('')

  const [
    { data: requestData, error: requestError },
    { data: rewardData, error: rewardError },
    { data: walletData, error: walletError },
  ] = await Promise.all([
    supabase.from('housework_requests').select('*').order('created_at', {
      ascending: false,
    }),

    supabase.from('housework_rewards').select('*').order('cost', {
      ascending: true,
    }),

    supabase.from('housework_wallet').select('*').eq('id', 1).single(),
  ])

  loading.value = false

  if (requestError || rewardError || walletError) {
    console.error(requestError || rewardError || walletError)

    setMessage('집안일 정보를 불러오지 못했어요.', true)

    return
  }

  requests.value = requestData ?? []

  rewards.value = rewardData ?? []

  balance.value = walletData?.balance ?? 0
}

/* 새 요청 사진 */

function handlePhotoChange(event) {
  const file = event.target.files?.[0]

  if (!file) {
    photoFile.value = null
    photoPreview.value = ''
    return
  }

  if (!file.type.startsWith('image/')) {
    setMessage('이미지 파일만 첨부할 수 있어요.', true)

    event.target.value = ''
    return
  }

  if (file.size > 8 * 1024 * 1024) {
    setMessage('사진은 8MB 이하로 올려주세요.', true)

    event.target.value = ''
    return
  }

  photoFile.value = file

  if (photoPreview.value) {
    URL.revokeObjectURL(photoPreview.value)
  }

  photoPreview.value = URL.createObjectURL(file)

  setMessage('')
}

function clearPhoto() {
  if (photoPreview.value) {
    URL.revokeObjectURL(photoPreview.value)
  }

  photoFile.value = null
  photoPreview.value = ''
}

async function uploadPhotoFile(file) {
  if (!file) {
    return null
  }

  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'

  const fileName = `${Date.now()}-${crypto.randomUUID()}.${extension}`

  const { error } = await supabase.storage.from('housework-photos').upload(fileName, file, {
    cacheControl: '3600',
    upsert: false,
  })

  if (error) {
    throw error
  }

  const { data } = supabase.storage.from('housework-photos').getPublicUrl(fileName)

  return data.publicUrl
}

async function uploadPhoto() {
  if (!photoFile.value) {
    return null
  }

  uploading.value = true

  try {
    return await uploadPhotoFile(photoFile.value)
  } finally {
    uploading.value = false
  }
}

/* 요청 추가 */

async function addRequest() {
  const trimmedTitle = title.value.trim()

  const trimmedMemo = memo.value.trim()

  if (!trimmedTitle || adding.value) {
    return
  }

  adding.value = true
  setMessage('')

  let photoUrl = null

  try {
    photoUrl = await uploadPhoto()
  } catch (error) {
    console.error(error)

    setMessage('사진을 업로드하지 못했어요.', true)

    adding.value = false
    return
  }

  const { data, error } = await supabase
    .from('housework_requests')
    .insert({
      title: trimmedTitle,
      memo: trimmedMemo || null,
      due_date: dueDate.value || null,
      priority: priority.value,
      status: '요청함',
      photo_url: photoUrl,
      thanks_points: 1,
    })
    .select()
    .single()

  adding.value = false

  if (error) {
    console.error(error)

    if (photoUrl) {
      await deletePhotoByUrl(photoUrl)
    }

    setMessage('집안일을 요청하지 못했어요.', true)

    return
  }

  requests.value.unshift(data)

  title.value = ''
  memo.value = ''
  dueDate.value = ''
  priority.value = '보통'

  clearPhoto()

  setMessage('오빠에게 집안일을 요청했어요.')
}

/* 요청 수정 */

function startEdit(item) {
  editingId.value = item.id

  editTitle.value = item.title ?? ''

  editMemo.value = item.memo ?? ''

  editDueDate.value = item.due_date ?? ''

  editPriority.value = item.priority ?? '보통'

  editOriginalPhotoUrl.value = item.photo_url ?? ''

  editPhotoPreview.value = item.photo_url ?? ''

  editPhotoFile.value = null

  removeExistingPhoto.value = false

  setMessage('')
}

function cancelEdit() {
  if (
    editPhotoFile.value &&
    editPhotoPreview.value &&
    editPhotoPreview.value !== editOriginalPhotoUrl.value
  ) {
    URL.revokeObjectURL(editPhotoPreview.value)
  }

  editingId.value = null

  editTitle.value = ''
  editMemo.value = ''
  editDueDate.value = ''
  editPriority.value = '보통'

  editPhotoFile.value = null
  editPhotoPreview.value = ''
  editOriginalPhotoUrl.value = ''

  removeExistingPhoto.value = false
}

function handleEditPhotoChange(event) {
  const file = event.target.files?.[0]

  if (!file) return

  if (!file.type.startsWith('image/')) {
    setMessage('이미지 파일만 첨부할 수 있어요.', true)

    event.target.value = ''
    return
  }

  if (file.size > 8 * 1024 * 1024) {
    setMessage('사진은 8MB 이하로 올려주세요.', true)

    event.target.value = ''
    return
  }

  if (
    editPhotoFile.value &&
    editPhotoPreview.value &&
    editPhotoPreview.value !== editOriginalPhotoUrl.value
  ) {
    URL.revokeObjectURL(editPhotoPreview.value)
  }

  editPhotoFile.value = file

  editPhotoPreview.value = URL.createObjectURL(file)

  removeExistingPhoto.value = false

  setMessage('')
}

function removeEditPhoto() {
  if (
    editPhotoFile.value &&
    editPhotoPreview.value &&
    editPhotoPreview.value !== editOriginalPhotoUrl.value
  ) {
    URL.revokeObjectURL(editPhotoPreview.value)
  }

  editPhotoFile.value = null
  editPhotoPreview.value = ''

  removeExistingPhoto.value = true
}

async function saveEdit(item) {
  const trimmedTitle = editTitle.value.trim()

  const trimmedMemo = editMemo.value.trim()

  if (!trimmedTitle || savingEdit.value) {
    return
  }

  savingEdit.value = true
  setMessage('')

  let newPhotoUrl = editOriginalPhotoUrl.value || null

  let uploadedNewPhoto = false

  try {
    if (editPhotoFile.value) {
      newPhotoUrl = await uploadPhotoFile(editPhotoFile.value)

      uploadedNewPhoto = true
    } else if (removeExistingPhoto.value) {
      newPhotoUrl = null
    }

    const { data, error } = await supabase
      .from('housework_requests')
      .update({
        title: trimmedTitle,
        memo: trimmedMemo || null,
        due_date: editDueDate.value || null,
        priority: editPriority.value,
        photo_url: newPhotoUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id)
      .select()
      .single()

    if (error) {
      if (uploadedNewPhoto && newPhotoUrl) {
        await deletePhotoByUrl(newPhotoUrl)
      }

      throw error
    }

    if (editOriginalPhotoUrl.value && (uploadedNewPhoto || removeExistingPhoto.value)) {
      await deletePhotoByUrl(editOriginalPhotoUrl.value)
    }

    const index = requests.value.findIndex((request) => request.id === item.id)

    if (index !== -1) {
      requests.value[index] = data
    }

    cancelEdit()

    setMessage('집안일 요청을 수정했어요.')
  } catch (error) {
    console.error(error)

    setMessage('요청을 수정하지 못했어요.', true)
  } finally {
    savingEdit.value = false
  }
}

/* 하트 포인트 */

async function setWalletBalance(nextBalance) {
  const safeBalance = Math.max(0, nextBalance)

  const { data, error } = await supabase
    .from('housework_wallet')
    .update({
      balance: safeBalance,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)
    .select()
    .single()

  if (error) {
    console.error(error)
    return false
  }

  balance.value = data.balance

  return true
}

/* 상태 변경 */

async function changeStatus(item, nextStatus) {
  if (item.status === nextStatus) {
    return
  }

  const previousStatus = item.status

  const wasCompleted = previousStatus === '완료'

  const willComplete = nextStatus === '완료'

  const changes = {
    status: nextStatus,
    updated_at: new Date().toISOString(),
  }

  if (willComplete) {
    changes.completed_at = new Date().toISOString()
  } else if (wasCompleted) {
    changes.completed_at = null
  }

  const { data, error } = await supabase
    .from('housework_requests')
    .update(changes)
    .eq('id', item.id)
    .select()
    .single()

  if (error) {
    console.error(error)

    setMessage('상태를 변경하지 못했어요.', true)

    return
  }

  if (!wasCompleted && willComplete) {
    const points = Number(item.thanks_points ?? 1)

    const walletSuccess = await setWalletBalance(balance.value + points)

    if (!walletSuccess) {
      setMessage('집안일은 완료됐지만 하트 포인트 적립에 실패했어요.', true)
    } else {
      setMessage(`${item.title} 완료! 하트 +${points} 💗`)
    }
  } else if (wasCompleted && !willComplete) {
    await setWalletBalance(balance.value - Number(item.thanks_points ?? 1))

    setMessage('완료 상태를 되돌렸어요.')
  } else {
    setMessage(`${item.title} 상태를 "${nextStatus}"으로 변경했어요.`)
  }

  const index = requests.value.findIndex((request) => request.id === item.id)

  if (index !== -1) {
    requests.value[index] = data
  }
}

/* 요청 삭제 */

async function removeRequest(item) {
  const confirmed = window.confirm(`"${item.title}" 요청을 삭제할까요?`)

  if (!confirmed) {
    return
  }

  if (item.status === '완료') {
    const confirmedCompleted = window.confirm(
      '완료된 요청을 삭제하면 적립된 하트 포인트도 줄어들어요. 계속할까요?',
    )

    if (!confirmedCompleted) {
      return
    }
  }

  const { error } = await supabase.from('housework_requests').delete().eq('id', item.id)

  if (error) {
    console.error(error)

    setMessage('요청을 삭제하지 못했어요.', true)

    return
  }

  if (item.photo_url) {
    await deletePhotoByUrl(item.photo_url)
  }

  if (item.status === '완료') {
    await setWalletBalance(balance.value - Number(item.thanks_points ?? 1))
  }

  requests.value = requests.value.filter((request) => request.id !== item.id)

  if (editingId.value === item.id) {
    cancelEdit()
  }

  setMessage('요청을 삭제했어요.')
}

/* 보상 추가 */

async function addReward() {
  const trimmedTitle = rewardTitle.value.trim()

  const cost = Number(rewardCost.value)

  if (!trimmedTitle || !Number.isInteger(cost) || cost < 1) {
    return
  }

  const { data, error } = await supabase
    .from('housework_rewards')
    .insert({
      title: trimmedTitle,
      emoji: rewardEmoji.value.trim() || '🎁',
      cost,
    })
    .select()
    .single()

  if (error) {
    console.error(error)

    setMessage('보상을 추가하지 못했어요.', true)

    return
  }

  rewards.value.push(data)

  rewards.value.sort((a, b) => a.cost - b.cost)

  rewardTitle.value = ''
  rewardEmoji.value = '🎁'
  rewardCost.value = 5

  setMessage('새 보상을 추가했어요.')
}

/* 보상 사용 */

async function redeemReward(reward) {
  if (balance.value < reward.cost) {
    setMessage(`하트가 ${reward.cost - balance.value}개 더 필요해요.`, true)

    return
  }

  const confirmed = window.confirm(
    `${reward.emoji} ${reward.title} 보상을 받을까요?\n하트 ${reward.cost}개가 사용돼요.`,
  )

  if (!confirmed) {
    return
  }

  const success = await setWalletBalance(balance.value - reward.cost)

  if (!success) {
    setMessage('보상을 사용하지 못했어요.', true)

    return
  }

  setMessage(`${reward.emoji} ${reward.title} 보상을 받았어요!`)
}

/* 보상 삭제 */

async function removeReward(reward) {
  const confirmed = window.confirm(`"${reward.title}" 보상을 삭제할까요?`)

  if (!confirmed) {
    return
  }

  const { error } = await supabase.from('housework_rewards').delete().eq('id', reward.id)

  if (error) {
    console.error(error)

    setMessage('보상을 삭제하지 못했어요.', true)

    return
  }

  rewards.value = rewards.value.filter((item) => item.id !== reward.id)

  setMessage('보상을 삭제했어요.')
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <section class="housework-view">
    <header class="section-header">
      <div>
        <h2>집안일</h2>

        <p>오늘 해야 할 집안일과 받을 수 있는 보상을 확인해요.</p>
      </div>

      <span class="heart-balance"> 💗 {{ balance }} </span>
    </header>

    <!-- 하트 포인트 -->
    <section class="game-panel">
      <div class="game-heading">
        <div>
          <span class="game-label"> 하트 포인트 </span>

          <strong> {{ balance }} 💗 </strong>
        </div>

        <div v-if="nextReward" class="next-reward">
          다음 보상까지

          <b> {{ nextReward.cost - balance }}개 </b>
        </div>

        <div v-else-if="rewards.length" class="next-reward">받을 수 있는 보상이 있어요 🎉</div>
      </div>

      <div class="progress-track">
        <div
          class="progress-bar"
          :style="{
            width: `${progressPercent}%`,
          }"
        />
      </div>

      <div v-if="nextReward" class="progress-caption">
        <span> 현재 {{ balance }} 💗 </span>

        <span>
          다음 목표:
          {{ nextReward.emoji }}
          {{ nextReward.title }}
          {{ nextReward.cost }} 💗
        </span>
      </div>

      <div v-else-if="!rewards.length" class="progress-caption">아직 등록된 보상이 없어요.</div>
    </section>

    <!-- 요약 -->
    <section class="summary-grid">
      <div class="summary-card">
        <span> 해야 함 </span>

        <strong>
          {{ requestedCount }}
        </strong>
      </div>

      <div class="summary-card">
        <span> 하는 중 </span>

        <strong>
          {{ doingCount }}
        </strong>
      </div>

      <div class="summary-card completed">
        <span> 완료 </span>

        <strong>
          {{ completedCount }}
        </strong>
      </div>
    </section>

    <p
      v-if="message"
      class="message"
      :class="{
        error: isError,
      }"
    >
      {{ message }}
    </p>

    <div v-if="loading" class="empty-state">집안일을 불러오는 중...</div>

    <template v-else>
      <!-- 해야 할 집안일 -->
      <section class="tasks-section main-focus-section">
        <div class="section-title-row">
          <div>
            <h3>해야 할 집안일</h3>

            <p>지금 해야 하는 일을 먼저 확인해요.</p>
          </div>

          <span class="section-count"> {{ activeRequests.length }}개 </span>
        </div>

        <div v-if="activeRequests.length" class="task-list">
          <article
            v-for="item in activeRequests"
            :key="item.id"
            class="task-card"
            :class="priorityClass(item.priority)"
          >
            <template v-if="editingId !== item.id">
              <div class="task-top">
                <div class="badges">
                  <span
                    class="status-badge"
                    :class="{
                      doing: item.status === '하는 중',
                    }"
                  >
                    {{ item.status }}
                  </span>

                  <span class="priority-badge" :class="priorityClass(item.priority)">
                    {{ item.priority }}
                  </span>
                </div>

                <div class="task-top-actions">
                  <button type="button" class="edit-button" @click="startEdit(item)">수정</button>

                  <button
                    type="button"
                    class="delete-button"
                    aria-label="삭제"
                    @click="removeRequest(item)"
                  >
                    ×
                  </button>
                </div>
              </div>

              <h4>
                {{ item.title }}
              </h4>

              <p v-if="item.due_date" class="due-date">
                📅
                {{ formatDate(item.due_date) }}까지
              </p>

              <p v-if="item.memo" class="task-memo">
                {{ item.memo }}
              </p>

              <img
                v-if="item.photo_url"
                :src="item.photo_url"
                :alt="`${item.title} 첨부 사진`"
                class="task-photo"
              />

              <div class="status-actions">
                <button
                  type="button"
                  :class="{
                    active: item.status === '요청함',
                  }"
                  @click="changeStatus(item, '요청함')"
                >
                  요청함
                </button>

                <button
                  type="button"
                  :class="{
                    active: item.status === '하는 중',
                  }"
                  @click="changeStatus(item, '하는 중')"
                >
                  하는 중
                </button>

                <button type="button" class="complete-button" @click="changeStatus(item, '완료')">
                  완료 +1 💗
                </button>
              </div>
            </template>

            <!-- 수정 -->
            <form v-else class="edit-form" @submit.prevent="saveEdit(item)">
              <div class="edit-heading">
                <strong> 요청 수정 </strong>

                <span> 제목, 날짜, 메모, 사진을 바꿀 수 있어요. </span>
              </div>

              <input v-model="editTitle" type="text" maxlength="80" placeholder="집안일 제목" />

              <textarea v-model="editMemo" rows="3" maxlength="250" placeholder="메모 (선택)" />

              <div class="form-row">
                <label>
                  <span> 언제까지? (선택) </span>

                  <input v-model="editDueDate" type="date" />
                </label>

                <label>
                  <span> 우선순위 </span>

                  <select v-model="editPriority">
                    <option value="보통">보통</option>

                    <option value="급함">급함</option>
                  </select>
                </label>
              </div>

              <div v-if="editPhotoPreview" class="photo-preview">
                <img :src="editPhotoPreview" alt="수정 사진 미리보기" />

                <button type="button" @click="removeEditPhoto">사진 지우기</button>
              </div>

              <label class="photo-input">
                <span>
                  {{ editPhotoPreview ? '다른 사진으로 교체' : '사진 추가' }}
                </span>

                <input type="file" accept="image/*" @change="handleEditPhotoChange" />
              </label>

              <div class="edit-actions">
                <button
                  type="button"
                  class="cancel-edit-button"
                  :disabled="savingEdit"
                  @click="cancelEdit"
                >
                  취소
                </button>

                <button
                  type="submit"
                  class="save-edit-button"
                  :disabled="!editTitle.trim() || savingEdit"
                >
                  {{ savingEdit ? '저장 중...' : '수정 저장' }}
                </button>
              </div>
            </form>
          </article>
        </div>

        <div v-else class="empty-state compact">🎉 지금 해야 할 집안일이 없어요.</div>
      </section>

      <!-- 오빠가 보는 보상 -->
      <section class="reward-section main-focus-section">
        <div class="section-title-row">
          <div>
            <h3>하트 포인트 보상</h3>

            <p>하트를 모아서 원하는 보상을 받아요.</p>
          </div>
        </div>

        <div v-if="sortedRewards.length" class="reward-list">
          <article
            v-for="reward in sortedRewards"
            :key="reward.id"
            class="reward-card"
            :class="{
              available: balance >= reward.cost,
            }"
          >
            <div class="reward-emoji">
              {{ reward.emoji }}
            </div>

            <strong>
              {{ reward.title }}
            </strong>

            <div class="reward-progress-info">
              <span>
                필요
                {{ reward.cost }}
                💗
              </span>

              <span>
                현재
                {{ balance }}
                💗
              </span>
            </div>

            <button
              type="button"
              class="reward-button"
              :disabled="balance < reward.cost"
              @click="redeemReward(reward)"
            >
              {{ balance >= reward.cost ? '보상 받기 🎉' : `${reward.cost - balance}개 더 필요` }}
            </button>
          </article>
        </div>

        <div v-else class="empty-state compact">아직 등록한 보상이 없어요.</div>
      </section>

      <!-- 완료 -->
      <section class="completed-section">
        <div class="section-title-row">
          <div>
            <h3>완료한 집안일</h3>

            <p>지금까지 완료한 요청이에요.</p>
          </div>

          <span class="section-count"> {{ completedRequests.length }}개 </span>
        </div>

        <div v-if="completedRequests.length" class="completed-list">
          <article v-for="item in completedRequests" :key="item.id" class="completed-card">
            <div>
              <strong> ✓ {{ item.title }} </strong>

              <span v-if="item.completed_at">
                {{ formatCompletedAt(item.completed_at) }}
                완료
              </span>
            </div>

            <div class="completed-actions">
              <span class="thanks-earned">
                +{{ item.thanks_points ?? 1 }}
                💗
              </span>

              <button type="button" @click="changeStatus(item, '요청함')">되돌리기</button>

              <button type="button" class="delete-completed" @click="removeRequest(item)">
                삭제
              </button>
            </div>
          </article>
        </div>

        <div v-else class="empty-state compact">아직 완료한 집안일이 없어요.</div>
      </section>

      <!-- 관리 영역 -->
      <section class="manage-divider">
        <span> 관리 </span>
      </section>

      <!-- 새 요청 -->
      <section class="request-section">
        <div class="section-title-row">
          <div>
            <h3>새 집안일 요청</h3>

            <p>새로운 부탁을 추가해요.</p>
          </div>
        </div>

        <form class="request-form" @submit.prevent="addRequest">
          <input v-model="title" type="text" maxlength="80" placeholder="예: 분리수거 해줘" />

          <textarea v-model="memo" rows="3" maxlength="250" placeholder="메모 (선택)" />

          <div class="form-row">
            <label>
              <span> 언제까지? (선택) </span>

              <input v-model="dueDate" type="date" />
            </label>

            <label>
              <span> 우선순위 </span>

              <select v-model="priority">
                <option value="보통">보통</option>

                <option value="급함">급함</option>
              </select>
            </label>
          </div>

          <label class="photo-input">
            <span> 사진 첨부 (선택) </span>

            <input type="file" accept="image/*" @change="handlePhotoChange" />
          </label>

          <div v-if="photoPreview" class="photo-preview">
            <img :src="photoPreview" alt="첨부 사진 미리보기" />

            <button type="button" @click="clearPhoto">사진 지우기</button>
          </div>

          <button
            type="submit"
            class="submit-button"
            :disabled="!title.trim() || adding || uploading"
          >
            {{ uploading ? '사진 올리는 중...' : adding ? '요청하는 중...' : '오빠에게 요청하기' }}
          </button>
        </form>
      </section>

      <!-- 보상 편집 -->
      <section class="reward-manage-section">
        <div class="section-title-row">
          <div>
            <h3>보상 편집</h3>

            <p>보상을 추가하거나 삭제해요.</p>
          </div>
        </div>

        <div v-if="sortedRewards.length" class="reward-manage-list">
          <div v-for="reward in sortedRewards" :key="reward.id" class="reward-manage-item">
            <span class="reward-manage-name">
              {{ reward.emoji }}
              {{ reward.title }}
            </span>

            <span class="reward-manage-cost"> {{ reward.cost }} 💗 </span>

            <button type="button" @click="removeReward(reward)">삭제</button>
          </div>
        </div>

        <form class="reward-form" @submit.prevent="addReward">
          <input v-model="rewardEmoji" type="text" maxlength="4" placeholder="🎁" />

          <input v-model="rewardTitle" type="text" maxlength="60" placeholder="예: 치킨 사주기" />

          <label>
            <span> 필요한 하트 </span>

            <input v-model.number="rewardCost" type="number" min="1" max="999" />
          </label>

          <button
            type="submit"
            :disabled="
              !rewardTitle.trim() || !Number.isInteger(Number(rewardCost)) || Number(rewardCost) < 1
            "
          >
            보상 추가
          </button>
        </form>
      </section>
    </template>
  </section>
</template>

<style scoped>
.housework-view {
  --title: #493957;
  --text: #443b49;
  --muted: #817487;
  --pink: #f3dce9;
  --pink-strong: #d895b9;
  --purple: #8d6da0;
  --purple-light: #f2e9f7;
  --line: #e9ddea;
  --green: #6f9f91;
  --red: #c86a75;

  width: 100%;
}

.section-header,
.section-title-row,
.game-heading,
.progress-caption,
.task-top,
.completed-card,
.completed-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.section-header {
  align-items: flex-end;
  margin-bottom: 18px;
}

.section-header h2,
.section-title-row h3 {
  margin: 0;
  color: var(--title);
}

.section-header h2 {
  font-size: 22px;
}

.section-header p,
.section-title-row p {
  margin: 5px 0 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
}

.heart-balance {
  flex: none;
  padding: 7px 12px;
  border-radius: 999px;
  background: #fff0f6;
  color: #ad6489;
  font-size: 13px;
  font-weight: 800;
}

/* 하트 포인트 */

.game-panel {
  margin-bottom: 12px;
  padding: 18px;
  border: 1px solid #ecd8e5;
  border-radius: 20px;
  background: linear-gradient(135deg, #fff, #fff5f9 55%, #f6effa);
  box-shadow: 0 6px 18px rgb(73 57 87 / 6%);
}

.game-label {
  display: block;
  margin-bottom: 3px;
  color: var(--muted);
  font-size: 11px;
}

.game-heading strong {
  color: #ad6489;
  font-size: 27px;
}

.next-reward {
  color: var(--muted);
  font-size: 12px;
  text-align: right;
}

.next-reward b {
  color: #ad6489;
}

.progress-track {
  overflow: hidden;
  height: 12px;
  margin-top: 14px;
  border-radius: 999px;
  background: #f1e7ee;
}

.progress-bar {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #e6a8c7, #c28ab8);
  transition: width 0.3s ease;
}

.progress-caption {
  margin-top: 8px;
  color: var(--muted);
  font-size: 10px;
}

/* 상태 요약 */

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 9px;
  margin-bottom: 22px;
}

.summary-card {
  padding: 13px;
  border: 1px solid var(--line);
  border-radius: 15px;
  background: white;
  text-align: center;
}

.summary-card span {
  display: block;
  color: var(--muted);
  font-size: 10px;
}

.summary-card strong {
  display: block;
  margin-top: 3px;
  color: var(--title);
  font-size: 19px;
}

.summary-card.completed {
  background: #f6fbf9;
}

/* 섹션 */

.tasks-section,
.reward-section,
.completed-section,
.request-section,
.reward-manage-section {
  margin-top: 22px;
}

.main-focus-section {
  padding: 18px;
  border: 1px solid var(--line);
  border-radius: 20px;
  background: rgb(255 255 255 / 45%);
}

.section-count {
  flex: none;
  padding: 5px 9px;
  border-radius: 999px;
  background: var(--purple-light);
  color: var(--purple);
  font-size: 11px;
  font-weight: 800;
}

/* 입력 */

.request-form,
.edit-form {
  display: grid;
  gap: 9px;
  margin-top: 12px;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: white;
}

.request-form input,
.request-form textarea,
.request-form select,
.edit-form input,
.edit-form textarea,
.edit-form select,
.reward-form input {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 11px 12px;
  border: 1px solid var(--line);
  border-radius: 11px;
  background: white;
  color: var(--text);
  font-family: inherit;
  font-size: 16px;
  outline: none;
}

.request-form textarea,
.edit-form textarea {
  resize: vertical;
}

.request-form input:focus,
.request-form textarea:focus,
.request-form select:focus,
.edit-form input:focus,
.edit-form textarea:focus,
.edit-form select:focus,
.reward-form input:focus {
  border-color: var(--pink-strong);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px;
}

.form-row label,
.photo-input,
.reward-form label {
  display: grid;
  gap: 5px;
}

.form-row label > span,
.photo-input > span,
.reward-form label > span {
  color: var(--muted);
  font-size: 10px;
  font-weight: 700;
}

.photo-preview {
  position: relative;
  overflow: hidden;
  border-radius: 14px;
}

.photo-preview img {
  display: block;
  width: 100%;
  max-height: 340px;
  object-fit: cover;
}

.photo-preview button {
  position: absolute;
  right: 8px;
  bottom: 8px;
  padding: 7px 10px;
  border: 0;
  border-radius: 9px;
  background: rgb(0 0 0 / 60%);
  color: white;
  font-size: 11px;
}

.submit-button {
  padding: 12px;
  border: 0;
  border-radius: 12px;
  background: var(--pink-strong);
  color: white;
  font-weight: 800;
  cursor: pointer;
}

.submit-button:disabled {
  opacity: 0.45;
}

.message {
  margin: 14px 0 0;
  color: var(--green);
  font-size: 12px;
  text-align: center;
}

.message.error {
  color: var(--red);
}

/* 할 일 */

.task-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 12px;
}

.task-card {
  padding: 15px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: white;
  box-shadow: 0 5px 16px rgb(73 57 87 / 6%);
}

.task-card.urgent {
  border-color: #e8bac1;
  background: #fffafb;
}

.badges,
.task-top-actions {
  display: flex;
  align-items: center;
  gap: 5px;
}

.status-badge,
.priority-badge {
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 800;
}

.status-badge {
  background: var(--purple-light);
  color: #725986;
}

.status-badge.doing {
  background: #edf5f2;
  color: #52786e;
}

.priority-badge.normal {
  background: #f4f1f4;
  color: var(--muted);
}

.priority-badge.urgent {
  background: #fde9ed;
  color: #ae5362;
}

.edit-button {
  padding: 5px 9px;
  border: 1px solid var(--pink-strong);
  border-radius: 8px;
  background: white;
  color: var(--pink-strong);
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
}

.task-card h4 {
  margin: 13px 0 6px;
  color: var(--title);
  font-size: 17px;
}

.due-date {
  margin: 0 0 6px;
  color: #ad6489;
  font-size: 11px;
  font-weight: 700;
}

.task-memo {
  margin: 0 0 10px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.task-photo {
  width: 100%;
  max-height: 280px;
  margin: 8px 0 11px;
  border-radius: 13px;
  object-fit: cover;
}

.delete-button {
  border: 0;
  background: transparent;
  color: var(--muted);
  font-size: 20px;
  cursor: pointer;
}

.status-actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  margin-top: 12px;
}

.status-actions button {
  padding: 8px 5px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: white;
  color: var(--muted);
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
}

.status-actions button.active {
  border-color: var(--purple);
  background: var(--purple-light);
  color: var(--purple);
}

.status-actions .complete-button {
  border-color: #e7bfd3;
  background: #fff6fa;
  color: #ad6489;
}

/* 수정 */

.edit-form {
  margin-top: 0;
  padding: 0;
  border: 0;
}

.edit-heading strong {
  display: block;
  color: var(--title);
  font-size: 15px;
}

.edit-heading span {
  display: block;
  margin-top: 3px;
  color: var(--muted);
  font-size: 10px;
}

.edit-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px;
}

.cancel-edit-button,
.save-edit-button {
  padding: 10px;
  border-radius: 10px;
  font-weight: 700;
  cursor: pointer;
}

.cancel-edit-button {
  border: 1px solid var(--line);
  background: white;
  color: var(--muted);
}

.save-edit-button {
  border: 0;
  background: var(--pink-strong);
  color: white;
}

.cancel-edit-button:disabled,
.save-edit-button:disabled {
  opacity: 0.45;
}

/* 보상 */

.reward-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 12px;
}

.reward-card {
  position: relative;
  padding: 18px 12px 13px;
  border: 1px solid var(--line);
  border-radius: 17px;
  background: white;
  text-align: center;
}

.reward-card.available {
  border-color: #e7bfd3;
  background: #fffafd;
}

.reward-emoji {
  margin-bottom: 7px;
  font-size: 28px;
}

.reward-card strong {
  display: block;
  color: var(--title);
  font-size: 14px;
}

.reward-progress-info {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 6px 12px;
  margin: 9px 0 12px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
}

.reward-progress-info span:first-child {
  color: #ad6489;
}

.reward-button {
  width: 100%;
  padding: 9px;
  border: 0;
  border-radius: 9px;
  background: var(--pink-strong);
  color: white;
  font-size: 10px;
  font-weight: 800;
  cursor: pointer;
}

.reward-button:disabled {
  background: #eee8ee;
  color: var(--muted);
  cursor: default;
}

/* 완료 */

.completed-list {
  display: grid;
  gap: 7px;
  margin-top: 12px;
}

.completed-card {
  padding: 11px 13px;
  border: 1px solid var(--line);
  border-radius: 13px;
  background: rgb(255 255 255 / 65%);
}

.completed-card > div:first-child {
  min-width: 0;
}

.completed-card strong {
  display: block;
  color: var(--text);
  font-size: 12px;
}

.completed-card span {
  display: block;
  margin-top: 3px;
  color: var(--muted);
  font-size: 9px;
}

.completed-actions {
  flex: none;
}

.completed-actions .thanks-earned {
  margin: 0;
  color: #ad6489;
  font-size: 11px;
  font-weight: 800;
}

.completed-actions button {
  border: 0;
  background: transparent;
  color: var(--muted);
  font-size: 10px;
  cursor: pointer;
}

.completed-actions .delete-completed {
  color: #b76c76;
}

/* 관리 구분선 */

.manage-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 38px;
}

.manage-divider::before,
.manage-divider::after {
  content: '';
  flex: 1;
  border-top: 1px dashed var(--line);
}

.manage-divider span {
  color: var(--muted);
  font-size: 10px;
  font-weight: 800;
}

/* 보상 편집 */

.reward-manage-section {
  margin-top: 28px;
}

.reward-manage-list {
  display: grid;
  gap: 7px;
  margin-top: 12px;
  margin-bottom: 12px;
}

.reward-manage-item {
  display: grid;
  grid-template-columns:
    minmax(0, 1fr)
    auto
    auto;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: white;
}

.reward-manage-name {
  min-width: 0;
  color: var(--text);
  font-size: 12px;
  font-weight: 700;
}

.reward-manage-cost {
  color: #ad6489;
  font-size: 11px;
  font-weight: 800;
}

.reward-manage-item button {
  padding: 6px 9px;
  border: 0;
  border-radius: 8px;
  background: #f5edf2;
  color: #ad6475;
  font-size: 10px;
  cursor: pointer;
}

.reward-form {
  display: grid;
  grid-template-columns:
    70px
    minmax(0, 2fr)
    minmax(130px, 1fr)
    auto;
  gap: 8px;
  margin-top: 12px;
  padding: 12px;
  border: 1px dashed var(--line);
  border-radius: 15px;
}

.reward-form button {
  border: 0;
  border-radius: 10px;
  padding: 10px 14px;
  background: var(--purple);
  color: white;
  font-weight: 700;
  cursor: pointer;
}

.reward-form button:disabled {
  opacity: 0.45;
}

/* 빈 상태 */

.empty-state {
  margin-top: 12px;
  padding: 42px 18px;
  border: 1px dashed var(--line);
  border-radius: 16px;
  color: var(--muted);
  text-align: center;
}

.empty-state.compact {
  padding: 24px 15px;
  font-size: 12px;
}

@media (max-width: 700px) {
  .task-list,
  .reward-list {
    grid-template-columns: 1fr;
  }

  .reward-form {
    grid-template-columns: 65px 1fr;
  }

  .reward-form label {
    grid-column: 1 / -1;
  }

  .reward-form button {
    grid-column: 1 / -1;
  }
}

@media (max-width: 640px) {
  .section-header {
    align-items: flex-start;
  }

  .game-heading {
    align-items: flex-start;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .summary-grid {
    gap: 6px;
  }

  .summary-card {
    padding: 11px 6px;
  }

  .status-actions {
    grid-template-columns: 1fr;
  }

  .completed-card {
    align-items: flex-start;
    flex-direction: column;
  }

  .completed-actions {
    width: 100%;
  }

  .main-focus-section {
    padding: 14px;
  }

  .reward-manage-item {
    grid-template-columns:
      minmax(0, 1fr)
      auto;
  }

  .reward-manage-item button {
    grid-column: 1 / -1;
    width: 100%;
  }
}
</style>
