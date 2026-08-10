<script setup>
import { computed, onMounted, ref } from 'vue'

import { supabase } from '@/lib/supabase'

const newItem = ref('')
const newMemo = ref('')

const wishItems = ref([])
const places = ref([])

const loading = ref(false)
const adding = ref(false)
const message = ref('')

const randomItem = ref(null)

const editingKey = ref(null)
const editTitle = ref('')
const editMemo = ref('')
const savingKey = ref(null)

const allItems = computed(() => {
  const wishes = wishItems.value.map((item) => ({
    id: item.id,
    key: `wish-${item.id}`,
    sourceType: 'wish',
    title: item.title,
    memo: item.memo,
    done: item.done,
    category: null,
  }))

  const placeItems = places.value.map((place) => ({
    id: place.id,
    key: `place-${place.id}`,
    sourceType: 'place',
    title: place.place_name,
    memo: place.memo,
    done: place.visited,
    category: place.category,
  }))

  return [...wishes, ...placeItems]
})

const remainingItems = computed(() => {
  return allItems.value.filter((item) => !item.done)
})

const remainingCount = computed(() => {
  return remainingItems.value.length
})

async function loadItems() {
  loading.value = true
  message.value = ''

  const [{ data: wishlistData, error: wishlistError }, { data: placesData, error: placesError }] =
    await Promise.all([
      supabase.from('date_wishlist_items').select('*').order('created_at', {
        ascending: false,
      }),

      supabase.from('date_places').select('*').order('created_at', {
        ascending: false,
      }),
    ])

  if (wishlistError || placesError) {
    console.error(wishlistError || placesError)

    message.value = '데이트 목록을 불러오지 못했어요.'

    loading.value = false
    return
  }

  wishItems.value = wishlistData ?? []
  places.value = placesData ?? []

  loading.value = false
}

async function addItem() {
  const title = newItem.value.trim()
  const memo = newMemo.value.trim()

  if (!title || adding.value) {
    return
  }

  adding.value = true
  message.value = ''

  const { data, error } = await supabase
    .from('date_wishlist_items')
    .insert({
      title,
      memo: memo || null,
      done: false,
    })
    .select()
    .single()

  if (error) {
    console.error(error)

    message.value = '목록을 추가하지 못했어요.'

    adding.value = false
    return
  }

  wishItems.value.unshift(data)

  newItem.value = ''
  newMemo.value = ''

  adding.value = false
}

function startEdit(item) {
  if (item.sourceType !== 'wish') {
    return
  }

  editingKey.value = item.key
  editTitle.value = item.title ?? ''
  editMemo.value = item.memo ?? ''
  message.value = ''
}

function cancelEdit() {
  editingKey.value = null
  editTitle.value = ''
  editMemo.value = ''
}

async function saveEdit(item) {
  const title = editTitle.value.trim()
  const memo = editMemo.value.trim()

  if (!title) {
    message.value = '하고 싶은 것을 입력해주세요.'
    return
  }

  savingKey.value = item.key
  message.value = ''

  const { data, error } = await supabase
    .from('date_wishlist_items')
    .update({
      title,
      memo: memo || null,
    })
    .eq('id', item.id)
    .select()
    .single()

  if (error) {
    console.error(error)

    message.value = '내용을 수정하지 못했어요.'
    savingKey.value = null
    return
  }

  const index = wishItems.value.findIndex((currentItem) => currentItem.id === item.id)

  if (index !== -1) {
    wishItems.value[index] = data
  }

  if (randomItem.value && randomItem.value.key === item.key) {
    randomItem.value = {
      ...randomItem.value,
      title: data.title,
      memo: data.memo,
    }
  }

  savingKey.value = null
  cancelEdit()

  message.value = '내용을 수정했어요.'
}

async function toggleItem(item) {
  if (item.sourceType === 'wish') {
    await toggleWishItem(item)
  } else {
    await togglePlaceItem(item)
  }
}

async function toggleWishItem(item) {
  const nextDone = !item.done

  const { data, error } = await supabase
    .from('date_wishlist_items')
    .update({
      done: nextDone,
    })
    .eq('id', item.id)
    .select()
    .single()

  if (error) {
    console.error(error)

    message.value = '체크 상태를 저장하지 못했어요.'
    return
  }

  const index = wishItems.value.findIndex((currentItem) => currentItem.id === item.id)

  if (index !== -1) {
    wishItems.value[index] = data
  }

  clearRandomIfCompleted(item, nextDone)
}

async function togglePlaceItem(item) {
  const nextVisited = !item.done

  const { data, error } = await supabase
    .from('date_places')
    .update({
      visited: nextVisited,
    })
    .eq('id', item.id)
    .select()
    .single()

  if (error) {
    console.error(error)

    message.value = '방문 상태를 저장하지 못했어요.'
    return
  }

  const index = places.value.findIndex((currentPlace) => currentPlace.id === item.id)

  if (index !== -1) {
    places.value[index] = data
  }

  clearRandomIfCompleted(item, nextVisited)
}

function clearRandomIfCompleted(item, completed) {
  if (completed && randomItem.value && randomItem.value.key === item.key) {
    randomItem.value = null
  }
}

async function removeItem(item) {
  const targetName = item.sourceType === 'place' ? '이 장소' : '이 항목'

  const confirmed = window.confirm(`${targetName}을 삭제할까요?`)

  if (!confirmed) {
    return
  }

  message.value = ''

  if (item.sourceType === 'wish') {
    const { error } = await supabase.from('date_wishlist_items').delete().eq('id', item.id)

    if (error) {
      console.error(error)

      message.value = '목록을 삭제하지 못했어요.'
      return
    }

    wishItems.value = wishItems.value.filter((wish) => wish.id !== item.id)
  } else {
    const { error } = await supabase.from('date_places').delete().eq('id', item.id)

    if (error) {
      console.error(error)

      message.value = '장소를 삭제하지 못했어요.'
      return
    }

    places.value = places.value.filter((place) => place.id !== item.id)
  }

  if (randomItem.value && randomItem.value.key === item.key) {
    randomItem.value = null
  }

  if (editingKey.value === item.key) {
    cancelEdit()
  }
}

function pickRandomItem() {
  if (!remainingItems.value.length) {
    randomItem.value = null
    return
  }

  if (remainingItems.value.length === 1) {
    randomItem.value = remainingItems.value[0]
    return
  }

  const candidates = randomItem.value
    ? remainingItems.value.filter((item) => item.key !== randomItem.value.key)
    : remainingItems.value

  const randomIndex = Math.floor(Math.random() * candidates.length)

  randomItem.value = candidates[randomIndex]
}

onMounted(() => {
  loadItems()
})
</script>

<template>
  <section class="wishlist-view">
    <header class="section-header">
      <div>
        <h2>하고 싶은 것</h2>

        <p>같이 해보고 싶은 것과 가보고 싶은 곳을 한 번에 모아봐요.</p>
      </div>

      <span class="count"> {{ remainingCount }}개 남음 </span>
    </header>

    <section class="random-box">
      <div class="random-heading">
        <div>
          <strong>오늘 뭐하지?</strong>

          <p>아직 하지 않은 것과 가보지 않은 곳 중 하나를 골라줘요.</p>
        </div>

        <button
          type="button"
          class="random-button"
          :disabled="remainingCount === 0"
          @click="pickRandomItem"
        >
          🎲 랜덤 뽑기
        </button>
      </div>

      <div v-if="randomItem" class="random-result">
        <span class="random-label"> 오늘의 데이트 </span>

        <span v-if="randomItem.sourceType === 'place'" class="random-place-badge">
          📍 {{ randomItem.category || '장소' }}
        </span>

        <strong>
          {{ randomItem.title }}
        </strong>

        <p v-if="randomItem.memo" class="random-memo">
          {{ randomItem.memo }}
        </p>

        <button type="button" class="reroll-button" @click="pickRandomItem">다시 뽑기</button>
      </div>

      <div v-else-if="remainingCount === 0" class="random-empty">아직 뽑을 항목이 없어요.</div>
    </section>

    <form class="add-form" @submit.prevent="addItem">
      <input v-model="newItem" type="text" maxlength="60" placeholder="예: 한강 피크닉 가기" />

      <input v-model="newMemo" type="text" maxlength="150" placeholder="메모 (선택)" />

      <button type="submit" :disabled="!newItem.trim() || adding">
        {{ adding ? '추가 중...' : '추가' }}
      </button>
    </form>

    <p v-if="message" class="message">
      {{ message }}
    </p>

    <div v-if="loading" class="empty-state">불러오는 중...</div>

    <div v-else-if="allItems.length" class="wish-list">
      <article
        v-for="item in allItems"
        :key="item.key"
        class="wish-card"
        :class="{
          done: item.done,
          place: item.sourceType === 'place',
        }"
      >
        <button
          type="button"
          class="check-button"
          :class="{
            checked: item.done,
          }"
          @click="toggleItem(item)"
        >
          ✓
        </button>

        <div class="wish-content">
          <template v-if="editingKey !== item.key">
            <div class="wish-heading">
              <span v-if="item.sourceType === 'place'" class="place-badge">
                📍 {{ item.category || '장소' }}
              </span>

              <span v-else class="wish-badge"> 하고 싶은 것 </span>
            </div>

            <span class="wish-title">
              {{ item.title }}
            </span>

            <span v-if="item.memo" class="wish-memo">
              {{ item.memo }}
            </span>

            <button
              v-if="item.sourceType === 'wish'"
              type="button"
              class="edit-button"
              @click="startEdit(item)"
            >
              수정
            </button>
          </template>

          <form v-else class="edit-form" @submit.prevent="saveEdit(item)">
            <input v-model="editTitle" type="text" maxlength="60" placeholder="하고 싶은 것" />

            <textarea v-model="editMemo" rows="3" maxlength="150" placeholder="메모 (선택)" />

            <div class="edit-actions">
              <button type="button" class="cancel-button" @click="cancelEdit">취소</button>

              <button
                type="submit"
                class="save-button"
                :disabled="!editTitle.trim() || savingKey === item.key"
              >
                {{ savingKey === item.key ? '저장 중...' : '저장' }}
              </button>
            </div>
          </form>
        </div>

        <button type="button" class="delete-button" aria-label="삭제" @click="removeItem(item)">
          ×
        </button>
      </article>
    </div>

    <div v-else class="empty-state">아직 하고 싶은 게 없어요.</div>
  </section>
</template>

<style scoped>
.wishlist-view {
  --title: #493957;
  --text: #443b49;
  --muted: #817487;
  --pink: #f3dce9;
  --pink-strong: #d895b9;
  --line: #e9ddea;
  --purple-light: #f2e9f7;
  --purple: #8d6da0;

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
  line-height: 1.6;
}

.count {
  flex-shrink: 0;
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--pink);
  color: var(--title);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.random-box {
  margin-bottom: 18px;
  padding: 16px;
  border: 1px solid #e6d4e4;
  border-radius: 18px;
  background: linear-gradient(135deg, #fff, #faf2f7);
}

.random-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.random-heading strong {
  color: var(--title);
  font-size: 16px;
}

.random-heading p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 12px;
}

.random-button {
  flex-shrink: 0;
  padding: 10px 13px;
  border: 0;
  border-radius: 12px;
  background: var(--purple);
  color: white;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.random-button:disabled {
  opacity: 0.4;
}

.random-result {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-top: 15px;
  padding: 18px;
  border-radius: 15px;
  background: white;
  text-align: center;
}

.random-label {
  color: var(--pink-strong);
  font-size: 11px;
  font-weight: 700;
}

.random-place-badge {
  padding: 5px 9px;
  border-radius: 999px;
  background: var(--purple-light);
  color: #6b527b;
  font-size: 11px;
  font-weight: 700;
}

.random-result strong {
  color: var(--title);
  font-size: 18px;
}

.random-memo {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
}

.reroll-button {
  padding: 7px 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: white;
  color: var(--muted);
  font-size: 11px;
  cursor: pointer;
}

.random-empty {
  margin-top: 14px;
  padding: 12px;
  color: var(--muted);
  font-size: 12px;
  text-align: center;
}

.add-form {
  display: grid;
  grid-template-columns: 1.5fr 2fr auto;
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
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
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
  padding: 10px 18px;
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
}

.message {
  margin: -4px 0 16px;
  color: #b45c75;
  font-size: 13px;
  text-align: center;
}

.wish-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.wish-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-height: 68px;
  padding: 13px;
  border: 1px solid var(--line);
  border-radius: 17px;
  background: white;
}

.wish-card.place {
  background: #fdfaff;
}

.wish-card.done {
  opacity: 0.6;
}

.check-button {
  display: flex;
  width: 27px;
  height: 27px;
  flex: none;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 2px solid var(--pink-strong);
  border-radius: 50%;
  background: white;
  color: transparent;
  font-weight: 700;
  cursor: pointer;
}

.check-button.checked {
  background: var(--pink-strong);
  color: white;
}

.wish-content {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.place-badge,
.wish-badge {
  display: inline-flex;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
}

.place-badge {
  background: var(--purple-light);
  color: #6b527b;
}

.wish-badge {
  background: #fff0f6;
  color: var(--pink-strong);
}

.wish-title {
  color: var(--text);
  font-size: 14px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.wish-memo {
  color: var(--muted);
  font-size: 11px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.wish-card.done .wish-title {
  text-decoration: line-through;
}

.edit-button {
  margin-top: 4px;
  padding: 6px 10px;
  border: 1px solid var(--pink-strong);
  border-radius: 9px;
  background: white;
  color: var(--pink-strong);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.edit-form {
  display: grid;
  width: 100%;
  gap: 8px;
}

.edit-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px;
}

.cancel-button,
.save-button {
  min-height: 38px;
  border-radius: 9px;
  font-size: 11px;
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

.delete-button {
  flex: none;
  padding: 3px 5px;
  border: 0;
  background: transparent;
  color: var(--muted);
  font-size: 20px;
  cursor: pointer;
}

.empty-state {
  padding: 45px 20px;
  border: 1px dashed var(--line);
  border-radius: 16px;
  color: var(--muted);
  font-size: 14px;
  text-align: center;
}

@media (max-width: 640px) {
  .section-header {
    align-items: flex-start;
  }

  .random-heading {
    align-items: stretch;
    flex-direction: column;
  }

  .random-button {
    width: 100%;
  }

  .add-form {
    grid-template-columns: 1fr;
  }

  .add-form button {
    width: 100%;
  }

  .wish-list {
    grid-template-columns: 1fr;
  }
}
</style>
