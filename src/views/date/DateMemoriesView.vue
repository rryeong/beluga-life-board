<script setup>
import { computed, onMounted, ref } from 'vue'

import { supabase } from '@/lib/supabase'

const BUCKET_NAME = 'date-memories'

const memoryDate = ref('')
const title = ref('')
const place = ref('')
const memo = ref('')

const memories = ref([])

const loading = ref(false)
const adding = ref(false)
const message = ref('')

const uploadingMemoryId = ref(null)
const replacingPhotoKey = ref('')
const savingMemoryId = ref(null)

const editingMemoryId = ref(null)

const editMemoryDate = ref('')
const editTitle = ref('')
const editPlace = ref('')
const editMemo = ref('')

const memoryCount = computed(() => {
  return memories.value.length
})

function formatDate(dateString) {
  if (!dateString) return ''

  const [year, month, day] = dateString.split('-')

  return `${year}.${month}.${day}`
}

function getPhotoUrl(path) {
  if (!path) return ''

  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path)

  return data.publicUrl
}

async function loadMemories() {
  loading.value = true
  message.value = ''

  const { data, error } = await supabase
    .from('date_memories')
    .select('*')
    .order('memory_date', {
      ascending: false,
    })
    .order('created_at', {
      ascending: false,
    })

  if (error) {
    console.error(error)

    message.value = '추억을 불러오지 못했어요.'

    loading.value = false
    return
  }

  memories.value = data ?? []

  loading.value = false
}

async function addMemory() {
  const trimmedTitle = title.value.trim()
  const trimmedPlace = place.value.trim()
  const trimmedMemo = memo.value.trim()

  if (!memoryDate.value || !trimmedTitle || adding.value) {
    return
  }

  adding.value = true
  message.value = ''

  const { data, error } = await supabase
    .from('date_memories')
    .insert({
      memory_date: memoryDate.value,
      title: trimmedTitle,
      place: trimmedPlace || null,
      memo: trimmedMemo || null,
      photo_path_1: null,
      photo_path_2: null,
    })
    .select()
    .single()

  if (error) {
    console.error(error)

    message.value = '추억을 저장하지 못했어요.'

    adding.value = false
    return
  }

  memories.value.unshift(data)

  memoryDate.value = ''
  title.value = ''
  place.value = ''
  memo.value = ''

  adding.value = false
}

function startEdit(memory) {
  editingMemoryId.value = memory.id

  editMemoryDate.value = memory.memory_date ?? ''
  editTitle.value = memory.title ?? ''
  editPlace.value = memory.place ?? ''
  editMemo.value = memory.memo ?? ''

  message.value = ''
}

function cancelEdit() {
  editingMemoryId.value = null

  editMemoryDate.value = ''
  editTitle.value = ''
  editPlace.value = ''
  editMemo.value = ''
}

async function saveMemory(memory) {
  const trimmedTitle = editTitle.value.trim()
  const trimmedPlace = editPlace.value.trim()
  const trimmedMemo = editMemo.value.trim()

  if (!editMemoryDate.value || !trimmedTitle) {
    message.value = '날짜와 제목은 꼭 입력해주세요.'
    return
  }

  savingMemoryId.value = memory.id
  message.value = ''

  const { data, error } = await supabase
    .from('date_memories')
    .update({
      memory_date: editMemoryDate.value,
      title: trimmedTitle,
      place: trimmedPlace || null,
      memo: trimmedMemo || null,
    })
    .eq('id', memory.id)
    .select()
    .single()

  if (error) {
    console.error(error)

    message.value = '추억 내용을 수정하지 못했어요.'

    savingMemoryId.value = null
    return
  }

  const index = memories.value.findIndex((item) => item.id === memory.id)

  if (index !== -1) {
    memories.value[index] = data
  }

  savingMemoryId.value = null
  cancelEdit()

  message.value = '추억 내용을 수정했어요.'
}

function createFilePath(memory, file) {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'

  return `${memory.id}/` + `${Date.now()}-` + `${crypto.randomUUID()}.` + extension
}

async function uploadPhotoFile(memory, file) {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('이미지 파일이 아니에요.')
  }

  const fileName = createFilePath(memory, file)

  const { error } = await supabase.storage.from(BUCKET_NAME).upload(fileName, file, {
    cacheControl: '3600',
    upsert: false,
  })

  if (error) {
    throw error
  }

  return fileName
}

async function handlePhotoSelect(event, memory) {
  const selectedFiles = Array.from(event.target.files ?? [])

  event.target.value = ''

  if (!selectedFiles.length) {
    return
  }

  const existingCount = [memory.photo_path_1, memory.photo_path_2].filter(Boolean).length

  const availableSlots = 2 - existingCount

  if (availableSlots <= 0) {
    message.value = '사진은 최대 2장까지 올릴 수 있어요.'
    return
  }

  const files = selectedFiles.slice(0, availableSlots)

  uploadingMemoryId.value = memory.id
  message.value = ''

  const uploadedPaths = []

  try {
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        continue
      }

      const uploadedPath = await uploadPhotoFile(memory, file)

      uploadedPaths.push(uploadedPath)
    }

    if (!uploadedPaths.length) {
      message.value = '올릴 수 있는 이미지가 없어요.'

      uploadingMemoryId.value = null
      return
    }

    const currentPaths = [memory.photo_path_1, memory.photo_path_2].filter(Boolean)

    const nextPaths = [...currentPaths, ...uploadedPaths].slice(0, 2)

    const { data, error: updateError } = await supabase
      .from('date_memories')
      .update({
        photo_path_1: nextPaths[0] ?? null,
        photo_path_2: nextPaths[1] ?? null,
      })
      .eq('id', memory.id)
      .select()
      .single()

    if (updateError) {
      throw updateError
    }

    const index = memories.value.findIndex((item) => item.id === memory.id)

    if (index !== -1) {
      memories.value[index] = data
    }

    message.value = '사진을 추가했어요.'
  } catch (error) {
    console.error(error)

    message.value = '사진 업로드 중 오류가 발생했어요.'
  } finally {
    uploadingMemoryId.value = null
  }
}

async function replacePhoto(event, memory, slot) {
  const file = event.target.files?.[0]

  event.target.value = ''

  if (!file) {
    return
  }

  if (!file.type.startsWith('image/')) {
    message.value = '이미지 파일만 선택할 수 있어요.'
    return
  }

  const oldPath = slot === 1 ? memory.photo_path_1 : memory.photo_path_2

  if (!oldPath) {
    return
  }

  const busyKey = `${memory.id}-${slot}`

  replacingPhotoKey.value = busyKey
  message.value = ''

  let newPath = ''

  try {
    newPath = await uploadPhotoFile(memory, file)

    const updateData =
      slot === 1
        ? {
            photo_path_1: newPath,
          }
        : {
            photo_path_2: newPath,
          }

    const { data, error: updateError } = await supabase
      .from('date_memories')
      .update(updateData)
      .eq('id', memory.id)
      .select()
      .single()

    if (updateError) {
      throw updateError
    }

    const index = memories.value.findIndex((item) => item.id === memory.id)

    if (index !== -1) {
      memories.value[index] = data
    }

    const { error: removeError } = await supabase.storage.from(BUCKET_NAME).remove([oldPath])

    if (removeError) {
      console.error(removeError)
    }

    message.value = '사진을 변경했어요.'
  } catch (error) {
    console.error(error)

    if (newPath) {
      await supabase.storage.from(BUCKET_NAME).remove([newPath])
    }

    message.value = '사진을 변경하지 못했어요.'
  } finally {
    replacingPhotoKey.value = ''
  }
}

async function removePhoto(memory, slot) {
  const path = slot === 1 ? memory.photo_path_1 : memory.photo_path_2

  if (!path) return

  const confirmed = window.confirm('이 사진을 삭제할까요?')

  if (!confirmed) {
    return
  }

  message.value = ''

  const { error: storageError } = await supabase.storage.from(BUCKET_NAME).remove([path])

  if (storageError) {
    console.error(storageError)

    message.value = '사진 파일을 삭제하지 못했어요.'
    return
  }

  const nextPhoto1 = slot === 1 ? memory.photo_path_2 : memory.photo_path_1

  const nextPhoto2 = null

  const { data, error } = await supabase
    .from('date_memories')
    .update({
      photo_path_1: nextPhoto1,
      photo_path_2: nextPhoto2,
    })
    .eq('id', memory.id)
    .select()
    .single()

  if (error) {
    console.error(error)

    message.value = '사진 정보를 수정하지 못했어요.'
    return
  }

  const index = memories.value.findIndex((item) => item.id === memory.id)

  if (index !== -1) {
    memories.value[index] = data
  }

  message.value = '사진을 삭제했어요.'
}

async function removeMemory(memory) {
  const confirmed = window.confirm('이 추억을 삭제할까요?')

  if (!confirmed) {
    return
  }

  message.value = ''

  const photoPaths = [memory.photo_path_1, memory.photo_path_2].filter(Boolean)

  if (photoPaths.length) {
    const { error: storageError } = await supabase.storage.from(BUCKET_NAME).remove(photoPaths)

    if (storageError) {
      console.error(storageError)

      message.value = '추억 사진을 삭제하지 못했어요.'
      return
    }
  }

  const { error } = await supabase.from('date_memories').delete().eq('id', memory.id)

  if (error) {
    console.error(error)

    message.value = '추억을 삭제하지 못했어요.'
    return
  }

  memories.value = memories.value.filter((item) => item.id !== memory.id)

  if (editingMemoryId.value === memory.id) {
    cancelEdit()
  }
}

onMounted(() => {
  loadMemories()
})
</script>

<template>
  <section class="memories-view">
    <header class="section-header">
      <div>
        <h2>추억</h2>

        <p>함께한 날과 사진을 하나씩 남겨두는 공간이에요.</p>
      </div>

      <span class="count"> {{ memoryCount }}개 </span>
    </header>

    <form class="add-form" @submit.prevent="addMemory">
      <input v-model="memoryDate" type="date" />

      <input v-model="title" type="text" maxlength="60" placeholder="추억 제목" />

      <input v-model="place" type="text" maxlength="60" placeholder="장소 (선택)" />

      <input v-model="memo" type="text" maxlength="150" placeholder="한 줄 메모 (선택)" />

      <button type="submit" :disabled="!memoryDate || !title.trim() || adding">
        {{ adding ? '저장 중...' : '추억 추가' }}
      </button>
    </form>

    <p v-if="message" class="message">
      {{ message }}
    </p>

    <div v-if="loading" class="empty-state">불러오는 중...</div>

    <div v-else-if="memories.length" class="memory-list">
      <article v-for="memory in memories" :key="memory.id" class="memory-card">
        <template v-if="editingMemoryId !== memory.id">
          <div class="card-top">
            <p class="memory-date">
              {{ formatDate(memory.memory_date) }}
            </p>

            <button
              type="button"
              class="delete-button"
              aria-label="추억 삭제"
              @click="removeMemory(memory)"
            >
              ×
            </button>
          </div>

          <h3>
            {{ memory.title }}
          </h3>

          <p v-if="memory.place" class="place">📍 {{ memory.place }}</p>
        </template>

        <form v-else class="edit-form" @submit.prevent="saveMemory(memory)">
          <label>
            <span>날짜</span>

            <input v-model="editMemoryDate" type="date" />
          </label>

          <label>
            <span>제목</span>

            <input v-model="editTitle" type="text" maxlength="60" />
          </label>

          <label>
            <span>장소</span>

            <input v-model="editPlace" type="text" maxlength="60" placeholder="장소 (선택)" />
          </label>

          <label>
            <span>메모</span>

            <textarea v-model="editMemo" maxlength="150" rows="3" placeholder="메모 (선택)" />
          </label>

          <div class="edit-actions">
            <button type="button" class="cancel-button" @click="cancelEdit">취소</button>

            <button
              type="submit"
              class="save-button"
              :disabled="!editMemoryDate || !editTitle.trim() || savingMemoryId === memory.id"
            >
              {{ savingMemoryId === memory.id ? '저장 중...' : '내용 저장' }}
            </button>
          </div>
        </form>

        <div v-if="memory.photo_path_1 || memory.photo_path_2" class="photo-grid">
          <div v-if="memory.photo_path_1" class="photo-item">
            <div class="photo-box">
              <img :src="getPhotoUrl(memory.photo_path_1)" alt="데이트 추억 사진" />

              <button
                type="button"
                class="photo-delete"
                aria-label="사진 삭제"
                @click="removePhoto(memory, 1)"
              >
                ×
              </button>
            </div>

            <label class="replace-photo-button">
              <input type="file" accept="image/*" @change="replacePhoto($event, memory, 1)" />

              <span>
                {{ replacingPhotoKey === `${memory.id}-1` ? '변경 중...' : '사진 변경' }}
              </span>
            </label>
          </div>

          <div v-if="memory.photo_path_2" class="photo-item">
            <div class="photo-box">
              <img :src="getPhotoUrl(memory.photo_path_2)" alt="데이트 추억 사진" />

              <button
                type="button"
                class="photo-delete"
                aria-label="사진 삭제"
                @click="removePhoto(memory, 2)"
              >
                ×
              </button>
            </div>

            <label class="replace-photo-button">
              <input type="file" accept="image/*" @change="replacePhoto($event, memory, 2)" />

              <span>
                {{ replacingPhotoKey === `${memory.id}-2` ? '변경 중...' : '사진 변경' }}
              </span>
            </label>
          </div>
        </div>

        <label v-if="!memory.photo_path_1 || !memory.photo_path_2" class="photo-upload">
          <input
            type="file"
            accept="image/*"
            multiple
            @change="handlePhotoSelect($event, memory)"
          />

          <span>
            {{ uploadingMemoryId === memory.id ? '사진 올리는 중...' : '+ 사진 추가' }}
          </span>
        </label>

        <p class="photo-guide">사진은 최대 2장까지 저장할 수 있어요.</p>

        <p v-if="editingMemoryId !== memory.id && memory.memo" class="memo">
          {{ memory.memo }}
        </p>

        <button
          v-if="editingMemoryId !== memory.id"
          type="button"
          class="edit-button"
          @click="startEdit(memory)"
        >
          수정
        </button>
      </article>
    </div>

    <div v-else class="empty-state">아직 남긴 추억이 없어요.</div>
  </section>
</template>

<style scoped>
.memories-view {
  --title: #493957;
  --text: #443b49;
  --muted: #817487;
  --pink: #f3dce9;
  --pink-strong: #d895b9;
  --line: #e9ddea;

  width: 100%;
}

.section-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.section-header h2 {
  margin: 0;
  color: var(--title);
  font-size: 22px;
}

.section-header p {
  margin: 5px 0 0;
  color: var(--muted);
  font-size: 13px;
}

.count {
  flex-shrink: 0;
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--pink);
  color: var(--title);
  font-size: 12px;
  font-weight: 700;
}

.add-form {
  display: grid;
  grid-template-columns:
    1.1fr
    1.5fr
    1.5fr
    2fr
    auto;
  gap: 8px;
  margin-bottom: 18px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: white;
}

.add-form input,
.edit-form input,
.edit-form textarea {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  padding: 11px 12px;
  border: 1px solid var(--line);
  border-radius: 11px;
  background: white;
  color: var(--text);
  font-size: 16px;
  font-family: inherit;
  outline: none;
}

.edit-form textarea {
  resize: vertical;
}

.add-form input:focus,
.edit-form input:focus,
.edit-form textarea:focus {
  border-color: var(--pink-strong);
}

.add-form button {
  padding: 10px 16px;
  border: 0;
  border-radius: 11px;
  background: var(--pink-strong);
  color: white;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.add-form button:disabled,
.save-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.message {
  margin: -4px 0 16px;
  color: #b45c75;
  font-size: 13px;
  text-align: center;
}

.memory-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.memory-card {
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: white;
  box-shadow: 0 5px 16px rgb(73 57 87 / 7%);
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.memory-date {
  margin: 0;
  color: var(--pink-strong);
  font-size: 12px;
  font-weight: 700;
}

.memory-card h3 {
  margin: 8px 0;
  color: var(--title);
  font-size: 18px;
}

.place {
  margin: 0 0 12px;
  color: var(--muted);
  font-size: 12px;
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 12px 0;
}

.photo-item {
  min-width: 0;
}

.photo-box {
  position: relative;
  overflow: hidden;
  aspect-ratio: 1 / 1;
  border-radius: 13px;
  background: #f2edf4;
}

.photo-box img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-delete {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: rgb(30 25 34 / 65%);
  color: white;
  font-size: 17px;
  cursor: pointer;
}

.replace-photo-button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  margin-top: 6px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: white;
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.replace-photo-button input,
.photo-upload input {
  display: none;
}

.photo-upload {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 44px;
  box-sizing: border-box;
  margin-top: 12px;
  padding: 11px;
  border: 1px dashed var(--pink-strong);
  border-radius: 12px;
  background: #fff8fb;
  color: var(--pink-strong);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.photo-guide {
  margin: 6px 0 0;
  color: #a49ba7;
  font-size: 10px;
  text-align: center;
}

.memo {
  margin: 13px 0 0;
  padding-top: 12px;
  border-top: 1px solid #f0e7ef;
  color: var(--text);
  font-size: 13px;
  line-height: 1.6;
}

.delete-button {
  padding: 3px 5px;
  border: 0;
  background: transparent;
  color: var(--muted);
  font-size: 20px;
  cursor: pointer;
}

.edit-button {
  width: 100%;
  min-height: 42px;
  margin-top: 13px;
  border: 1px solid var(--pink-strong);
  border-radius: 11px;
  background: white;
  color: var(--pink-strong);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.edit-form {
  display: grid;
  gap: 10px;
  margin-bottom: 12px;
  padding: 12px;
  border-radius: 14px;
  background: #fff8fb;
}

.edit-form label {
  display: grid;
  gap: 5px;
}

.edit-form label > span {
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
}

.edit-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.cancel-button,
.save-button {
  min-height: 42px;
  border-radius: 11px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.cancel-button {
  border: 1px solid var(--line);
  background: white;
  color: var(--muted);
}

.save-button {
  border: 0;
  background: var(--pink-strong);
  color: white;
}

.empty-state {
  padding: 45px 20px;
  border: 1px dashed var(--line);
  border-radius: 16px;
  color: var(--muted);
  font-size: 14px;
  text-align: center;
}

@media (max-width: 760px) {
  .add-form {
    grid-template-columns: repeat(2, 1fr);
  }

  .add-form button {
    grid-column: 1 / -1;
  }
}

@media (max-width: 640px) {
  .section-header {
    align-items: flex-start;
  }

  .add-form {
    grid-template-columns: 1fr;
  }

  .add-form button {
    grid-column: auto;
    width: 100%;
  }

  .memory-list {
    grid-template-columns: 1fr;
  }
}
</style>
