<script setup>
import { computed, onMounted, ref } from 'vue'
import { supabase, JIBBAP_TABLE } from '@/lib/supabase'

const OWNER_NAME = '벨루'

const freezerItems = ref([])

const ingredientName = ref('')
const ingredientMemo = ref('')

const loading = ref(true)
const saving = ref(false)
const updatingId = ref(null)

const statusMessage = ref('')
const isError = ref(false)

function setStatus(message, error = false) {
  statusMessage.value = message
  isError.value = error
}

function rowToItem(row) {
  return {
    id: row.id,
    name: row.name,
    memo: row.memo || '',
    done: Boolean(row.done),
    createdAt: row.created_at ? new Date(row.created_at).getTime() : 0,
  }
}

const sortedItems = computed(() => {
  return [...freezerItems.value].sort((a, b) => {
    const doneDifference = Number(a.done) - Number(b.done)

    if (doneDifference !== 0) {
      return doneDifference
    }

    return b.createdAt - a.createdAt
  })
})

const activeItemCount = computed(() => {
  return freezerItems.value.filter((item) => !item.done).length
})

const completedItemCount = computed(() => {
  return freezerItems.value.filter((item) => item.done).length
})

const itemCountText = computed(() => {
  if (freezerItems.value.length === 0) {
    return '아직 없음'
  }

  if (completedItemCount.value === 0) {
    return `${activeItemCount.value}개 보관 중`
  }

  return `${activeItemCount.value}개 보관 중 · ` + `${completedItemCount.value}개 완료`
})

async function loadFreezerItems() {
  loading.value = true
  setStatus('냉동고 재료를 불러오는 중...')

  const { data, error } = await supabase
    .from(JIBBAP_TABLE)
    .select('*')
    .eq('category', 'freezer')
    .order('created_at', {
      ascending: false,
    })

  loading.value = false

  if (error) {
    console.error(error)

    setStatus(`불러오기 실패: ${error.message}`, true)

    return
  }

  freezerItems.value = (data || []).map(rowToItem)

  setStatus('공유 데이터와 동기화됨')
}

async function addIngredient() {
  const name = ingredientName.value.trim()
  const memo = ingredientMemo.value.trim()

  if (!name || saving.value) return

  saving.value = true
  setStatus('재료를 저장하는 중...')

  const row = {
    category: 'freezer',
    name,
    memo,
    added_by: OWNER_NAME,
    done: false,
    rating: 0,
  }

  const { data, error } = await supabase.from(JIBBAP_TABLE).insert(row).select().single()

  saving.value = false

  if (error) {
    console.error(error)

    setStatus(`추가 실패: ${error.message}`, true)

    return
  }

  freezerItems.value.push(rowToItem(data))

  ingredientName.value = ''
  ingredientMemo.value = ''

  setStatus('냉동고 재료를 추가했습니다.')
}

async function toggleIngredientDone(item) {
  if (updatingId.value) return

  const nextDone = !item.done

  updatingId.value = item.id
  setStatus(nextDone ? '완료 처리하는 중...' : '완료를 취소하는 중...')

  const { error } = await supabase
    .from(JIBBAP_TABLE)
    .update({
      done: nextDone,
      updated_at: new Date().toISOString(),
    })
    .eq('id', item.id)

  updatingId.value = null

  if (error) {
    console.error(error)

    setStatus(`완료 처리 실패: ${error.message}`, true)

    return
  }

  item.done = nextDone

  setStatus(nextDone ? `${item.name}을 다 먹었어요.` : `${item.name} 완료를 취소했습니다.`)
}

async function removeIngredient(item) {
  const shouldDelete = window.confirm(`"${item.name}" 재료를 삭제할까요?`)

  if (!shouldDelete) return

  const { error } = await supabase.from(JIBBAP_TABLE).delete().eq('id', item.id)

  if (error) {
    console.error(error)

    setStatus(`삭제 실패: ${error.message}`, true)

    return
  }

  freezerItems.value = freezerItems.value.filter((target) => target.id !== item.id)

  setStatus('재료를 삭제했습니다.')
}

onMounted(() => {
  loadFreezerItems()
})
</script>

<template>
  <section class="freezer-view">
    <header class="section-header">
      <div>
        <h3>냉동고 속 재료</h3>

        <p>냉동 보관 중인 재료와 밀프렙을 관리해요.</p>
      </div>

      <span class="item-count">
        {{ itemCountText }}
      </span>
    </header>

    <p class="sync-status" :class="{ error: isError }">
      {{ statusMessage }}
    </p>

    <div v-if="loading" class="loading">냉동고 문 여는 중...</div>

    <div v-else-if="sortedItems.length === 0" class="empty">냉동고가 비어 있어요.</div>

    <div v-else class="ingredient-grid">
      <article
        v-for="item in sortedItems"
        :key="item.id"
        class="ingredient-card"
        :class="{
          completed: item.done,
        }"
      >
        <button
          type="button"
          class="delete-button"
          aria-label="재료 삭제"
          @click="removeIngredient(item)"
        >
          ×
        </button>

        <strong class="ingredient-name">
          {{ item.name }}
        </strong>

        <span v-if="item.done" class="completed-label"> 완료됨 </span>

        <p v-if="item.memo" class="ingredient-memo">
          {{ item.memo }}
        </p>

        <p v-else class="ingredient-memo empty-memo">메모 없음</p>

        <button
          type="button"
          class="complete-button"
          :class="{
            completed: item.done,
          }"
          :disabled="updatingId === item.id"
          @click="toggleIngredientDone(item)"
        >
          {{ updatingId === item.id ? '저장 중...' : item.done ? '완료 취소' : '다 먹었어요' }}
        </button>

        <footer class="card-footer">
          <span class="storage-badge"> 냉동 </span>
        </footer>
      </article>
    </div>

    <form class="add-form" @submit.prevent="addIngredient">
      <input
        v-model="ingredientName"
        type="text"
        maxlength="40"
        placeholder="예: 소불고기 밀프렙 2팩"
      />

      <input
        v-model="ingredientMemo"
        type="text"
        maxlength="40"
        placeholder="메모 선택, 예: 냉동일 8/1"
      />

      <button type="submit" class="add-button" :disabled="saving || !ingredientName.trim()">
        {{ saving ? '저장 중' : '추가' }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.freezer-view {
  --ink: #1e2a2e;
  --ink-soft: #5b6b73;
  --pink: #ff9eb1;
  --pink-dark: #e98298;
  --ice: #b9cadf;
  --ice-dark: #71859d;
  --stamp: #b23a2e;
  --title: #123847;
  --muted: #6c7b83;
  --line: rgb(23 58 71 / 10%);
}

.section-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.section-header h3 {
  margin: 0;
  color: var(--title);
  font-size: 22px;
}

.section-header p {
  margin: 5px 0 0;
  color: var(--muted);
  font-size: 13px;
}

.item-count {
  color: var(--muted);
  font-size: 13px;
  text-align: right;
}

.sync-status {
  min-height: 18px;
  margin: 0 0 10px;
  color: var(--muted);
  font-size: 11px;
  text-align: center;
}

.sync-status.error {
  color: var(--stamp);
}

.loading {
  padding: 50px 0;
  color: var(--muted);
  text-align: center;
}

.empty {
  margin-bottom: 16px;
  padding: 24px 16px;
  border: 1px dashed var(--line);
  border-radius: 12px;
  background: rgb(255 255 255 / 68%);
  color: var(--muted);
  text-align: center;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.ingredient-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 18px;
}

.ingredient-card {
  position: relative;
  display: flex;
  min-height: 205px;
  flex-direction: column;
  padding: 17px 16px 16px;
  border: 1px solid rgb(255 255 255 / 75%);
  border-radius: 18px;
  background: rgb(255 255 255 / 54%);
  box-shadow:
    0 4px 12px rgb(0 0 0 / 5%),
    inset 0 1px 0 rgb(255 255 255 / 78%);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    background 0.2s ease,
    opacity 0.2s ease;
}

.ingredient-card:hover {
  transform: translateY(-3px);
  background: rgb(255 255 255 / 72%);
  box-shadow:
    0 8px 18px rgb(0 0 0 / 7%),
    inset 0 1px 0 rgb(255 255 255 / 90%);
}

.ingredient-card.completed {
  opacity: 0.52;
}

.ingredient-card.completed:hover {
  opacity: 0.72;
}

.ingredient-card.completed .ingredient-name {
  color: var(--ink-soft);
  text-decoration: line-through;
}

.ingredient-name {
  padding-right: 27px;
  color: var(--ink);
  font-size: 16px;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.completed-label {
  width: fit-content;
  margin-top: 8px;
  border-radius: 999px;
  padding: 4px 8px;
  background: rgb(178 58 46 / 8%);
  color: var(--stamp);
  font-size: 10px;
  font-weight: 700;
}

.ingredient-memo {
  flex: 1;
  margin: 10px 0 15px;
  color: var(--ink-soft);
  font-size: 12px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.ingredient-memo.empty-memo {
  color: rgb(91 107 115 / 42%);
}

.complete-button {
  width: 100%;
  margin-bottom: 12px;
  border: 1px solid rgb(255 255 255 / 78%);
  border-radius: 9px;
  padding: 8px 10px;
  background: rgb(255 255 255 / 58%);
  color: var(--title);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.complete-button:hover:not(:disabled) {
  background: rgb(255 255 255 / 88%);
}

.complete-button.completed {
  background: rgb(178 58 46 / 8%);
  color: var(--stamp);
}

.complete-button:disabled {
  cursor: wait;
  opacity: 0.55;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  margin-top: auto;
}

.storage-badge {
  border: 1px solid rgb(255 255 255 / 68%);
  border-radius: 999px;
  padding: 4px 8px;
  background: rgb(185 202 223 / 18%);
  color: var(--ice-dark);
  font-size: 10px;
  font-weight: 700;
}

.delete-button {
  position: absolute;
  top: 9px;
  right: 10px;
  width: 28px;
  height: 28px;
  border: 1px solid rgb(255 255 255 / 65%);
  border-radius: 50%;
  background: rgb(255 255 255 / 44%);
  color: var(--ink-soft);
  font-size: 18px;
  cursor: pointer;
  opacity: 0.65;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.delete-button:hover {
  background: rgb(255 255 255 / 85%);
  color: var(--stamp);
  opacity: 1;
}

.add-form {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding: 12px;
  border: 1px solid rgb(255 255 255 / 72%);
  border-radius: 12px;
  background: rgb(255 255 255 / 58%);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.add-form input {
  min-width: 180px;
  flex: 1 1 220px;
  border: 1px solid rgb(255 255 255 / 82%);
  border-radius: 8px;
  padding: 11px 12px;
  background: rgb(255 255 255 / 72%);
  color: var(--ink);
}

.add-form input:focus {
  border-color: rgb(185 202 223 / 65%);
  outline: 3px solid rgb(185 202 223 / 16%);
}

.add-button {
  border: 0;
  border-radius: 8px;
  padding: 10px 18px;
  background: var(--pink);
  color: white;
  font-weight: 700;
  cursor: pointer;
}

.add-button:hover {
  background: var(--pink-dark);
}

.add-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

@media (max-width: 900px) {
  .ingredient-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .section-header {
    align-items: flex-start;
  }

  .ingredient-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .ingredient-card {
    min-height: 195px;
    padding: 14px 13px 13px;
    border-radius: 14px;
  }

  .ingredient-name {
    padding-right: 24px;
    font-size: 14px;
  }

  .ingredient-memo {
    margin-top: 8px;
    font-size: 11px;
  }

  .complete-button {
    padding: 7px 8px;
    font-size: 10px;
  }

  .storage-badge {
    padding: 3px 6px;
    font-size: 9px;
  }

  .add-form {
    display: grid;
    grid-template-columns: 1fr;
  }

  .add-form input {
    width: 100%;
    min-width: 0;
  }
}
</style>
