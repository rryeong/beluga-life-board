<script setup>
import { computed, onMounted, ref } from 'vue'

import { supabase } from '@/lib/supabase'

const newItem = ref('')
const items = ref([])

const loading = ref(false)
const adding = ref(false)
const message = ref('')

const randomItem = ref(null)

const remainingItems = computed(() => {
  return items.value.filter((item) => !item.done)
})

const remainingCount = computed(() => {
  return remainingItems.value.length
})

async function loadItems() {
  loading.value = true
  message.value = ''

  const { data, error } = await supabase
    .from('date_wishlist_items')
    .select('*')
    .order('created_at', {
      ascending: false,
    })

  if (error) {
    console.error(error)

    message.value = '데이트 목록을 불러오지 못했어요.'

    loading.value = false

    return
  }

  items.value = data ?? []

  loading.value = false
}

async function addItem() {
  const title = newItem.value.trim()

  if (!title || adding.value) {
    return
  }

  adding.value = true
  message.value = ''

  const { data, error } = await supabase
    .from('date_wishlist_items')
    .insert({
      title,
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

  items.value.unshift(data)

  newItem.value = ''

  adding.value = false
}

async function toggleItem(item) {
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

  const index = items.value.findIndex((currentItem) => currentItem.id === item.id)

  if (index !== -1) {
    items.value[index] = data
  }

  if (randomItem.value && randomItem.value.id === item.id && nextDone) {
    randomItem.value = null
  }
}

async function removeItem(id) {
  const confirmed = window.confirm('이 항목을 삭제할까요?')

  if (!confirmed) {
    return
  }

  const { error } = await supabase.from('date_wishlist_items').delete().eq('id', id)

  if (error) {
    console.error(error)

    message.value = '목록을 삭제하지 못했어요.'

    return
  }

  items.value = items.value.filter((item) => item.id !== id)

  if (randomItem.value && randomItem.value.id === id) {
    randomItem.value = null
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
    ? remainingItems.value.filter((item) => item.id !== randomItem.value.id)
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

        <p>같이 해보고 싶은 것들을 하나씩 적어두는 공간이에요.</p>
      </div>

      <span class="count"> {{ remainingCount }}개 남음 </span>
    </header>

    <section class="random-box">
      <div class="random-heading">
        <div>
          <strong>오늘 뭐하지?</strong>

          <p>아직 하지 않은 것 중에서 하나를 골라줘요.</p>
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

        <strong>
          {{ randomItem.title }}
        </strong>

        <button type="button" class="reroll-button" @click="pickRandomItem">다시 뽑기</button>
      </div>

      <div v-else-if="remainingCount === 0" class="random-empty">아직 뽑을 항목이 없어요.</div>
    </section>

    <form class="add-form" @submit.prevent="addItem">
      <input v-model="newItem" type="text" maxlength="60" placeholder="예: 한강 피크닉 가기" />

      <button type="submit" :disabled="!newItem.trim() || adding">
        {{ adding ? '추가 중...' : '추가' }}
      </button>
    </form>

    <p v-if="message" class="message">
      {{ message }}
    </p>

    <div v-if="loading" class="empty-state">불러오는 중...</div>

    <div v-else-if="items.length" class="wish-list">
      <article
        v-for="item in items"
        :key="item.id"
        class="wish-card"
        :class="{
          done: item.done,
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

        <span class="wish-title">
          {{ item.title }}
        </span>

        <button type="button" class="delete-button" aria-label="삭제" @click="removeItem(item.id)">
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
  line-height: 1.3;
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

  box-shadow: 0 5px 16px rgb(73 57 87 / 6%);
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
  line-height: 1.5;
}

.random-button {
  flex-shrink: 0;

  padding: 10px 13px;

  border: 0;
  border-radius: 12px;

  background: #8d6da0;

  color: white;

  font-size: 13px;
  font-weight: 700;

  cursor: pointer;
}

.random-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
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

.random-result strong {
  color: var(--title);

  font-size: 18px;
  line-height: 1.5;
}

.reroll-button {
  margin-top: 2px;

  padding: 7px 12px;

  border: 1px solid var(--line);
  border-radius: 10px;

  background: #fff;

  color: var(--muted);

  font-size: 11px;

  cursor: pointer;
}

.random-empty {
  margin-top: 14px;

  padding: 12px;

  border-radius: 12px;

  background: rgb(255 255 255 / 60%);

  color: var(--muted);

  font-size: 12px;
  text-align: center;
}

.add-form {
  display: grid;
  grid-template-columns: 1fr auto;

  gap: 8px;

  margin-bottom: 18px;
  padding: 12px;

  border: 1px solid var(--line);
  border-radius: 16px;

  background: white;

  box-shadow: 0 4px 14px rgb(73 57 87 / 5%);
}

.add-form input {
  width: 100%;
  min-width: 0;

  box-sizing: border-box;

  padding: 11px 12px;

  border: 1px solid var(--line);
  border-radius: 11px;

  background: white;

  color: var(--text);

  font-size: 14px;

  outline: none;
}

.add-form input:focus {
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

.add-form button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
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
  align-items: center;

  gap: 10px;

  min-height: 68px;

  padding: 13px;

  border: 1px solid var(--line);
  border-radius: 17px;

  background: white;

  box-shadow: 0 5px 16px rgb(73 57 87 / 7%);
}

.wish-card.done {
  opacity: 0.6;
}

.check-button {
  display: flex;

  width: 25px;
  height: 25px;

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

.wish-title {
  min-width: 0;
  flex: 1;

  color: var(--text);

  font-size: 14px;
  line-height: 1.5;

  overflow-wrap: anywhere;
}

.wish-card.done .wish-title {
  text-decoration: line-through;
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

  background: rgb(255 255 255 / 45%);

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

  .wish-list {
    grid-template-columns: 1fr;
  }

  .add-form {
    grid-template-columns: 1fr;
  }

  .add-form button {
    width: 100%;
  }
}
</style>
