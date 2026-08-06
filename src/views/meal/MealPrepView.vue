<script setup>
import { computed, onMounted, ref } from 'vue'
import { supabase, JIBBAP_TABLE } from '@/lib/supabase'

const OWNER_NAME = '벨루'

const mealPrepItems = ref([])

const mealPrepName = ref('')
const initialQuantity = ref(1)

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
    quantity: Number(row.quantity ?? 1),
    done: Boolean(row.done),
    createdAt: row.created_at ? new Date(row.created_at).getTime() : 0,
  }
}

const sortedItems = computed(() => {
  return [...mealPrepItems.value].sort((a, b) => {
    if (a.quantity === 0 && b.quantity !== 0) {
      return 1
    }

    if (a.quantity !== 0 && b.quantity === 0) {
      return -1
    }

    return b.createdAt - a.createdAt
  })
})

const totalQuantity = computed(() => {
  return mealPrepItems.value.reduce((sum, item) => sum + item.quantity, 0)
})

const itemCountText = computed(() => {
  if (mealPrepItems.value.length === 0) {
    return '등록된 밀프렙 없음'
  }

  return `${mealPrepItems.value.length}종 · ` + `총 ${totalQuantity.value}개`
})

async function loadMealPrepItems() {
  loading.value = true
  setStatus('밀프렙을 불러오는 중...')

  const { data, error } = await supabase
    .from(JIBBAP_TABLE)
    .select('*')
    .eq('category', 'menu')
    .eq('menu_type', '밀프렙')
    .order('created_at', {
      ascending: false,
    })

  loading.value = false

  if (error) {
    console.error(error)

    setStatus(`불러오기 실패: ${error.message}`, true)

    return
  }

  mealPrepItems.value = (data || []).map(rowToItem)

  setStatus('공유 데이터와 동기화됨')
}

async function addMealPrep() {
  const name = mealPrepName.value.trim()
  const quantity = Number(initialQuantity.value)

  if (!name || saving.value || !Number.isInteger(quantity) || quantity < 1) {
    return
  }

  saving.value = true
  setStatus('밀프렙을 저장하는 중...')

  const row = {
    category: 'menu',
    name,
    menu_type: '밀프렙',
    quantity,
    meal_date: null,
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

  mealPrepItems.value.push(rowToItem(data))

  mealPrepName.value = ''
  initialQuantity.value = 1

  setStatus('밀프렙을 추가했습니다.')
}

async function changeQuantity(item, amount) {
  if (updatingId.value) return

  const nextQuantity = Math.max(0, item.quantity + amount)

  if (nextQuantity === item.quantity) return

  updatingId.value = item.id

  const { error } = await supabase
    .from(JIBBAP_TABLE)
    .update({
      quantity: nextQuantity,
      done: nextQuantity === 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', item.id)

  updatingId.value = null

  if (error) {
    console.error(error)

    setStatus(`수량 변경 실패: ${error.message}`, true)

    return
  }

  item.quantity = nextQuantity
  item.done = nextQuantity === 0

  setStatus(
    nextQuantity === 0
      ? `${item.name}을 모두 먹었습니다.`
      : `${item.name} 수량을 ${nextQuantity}개로 변경했습니다.`,
  )
}

async function removeMealPrep(item) {
  const shouldDelete = window.confirm(`"${item.name}" 밀프렙을 삭제할까요?`)

  if (!shouldDelete) return

  const { error } = await supabase.from(JIBBAP_TABLE).delete().eq('id', item.id)

  if (error) {
    console.error(error)

    setStatus(`삭제 실패: ${error.message}`, true)

    return
  }

  mealPrepItems.value = mealPrepItems.value.filter((target) => target.id !== item.id)

  setStatus('밀프렙을 삭제했습니다.')
}

onMounted(() => {
  loadMealPrepItems()
})
</script>

<template>
  <section class="meal-prep-view">
    <header class="section-header">
      <div>
        <h3>밀프렙</h3>

        <p>미리 준비한 음식의 남은 개수를 관리해요.</p>
      </div>

      <span class="item-count">
        {{ itemCountText }}
      </span>
    </header>

    <p class="sync-status" :class="{ error: isError }">
      {{ statusMessage }}
    </p>

    <div v-if="loading" class="loading">밀프렙을 불러오는 중...</div>

    <div v-else-if="sortedItems.length === 0" class="empty">등록된 밀프렙이 없어요.</div>

    <div v-else class="meal-prep-grid">
      <article
        v-for="item in sortedItems"
        :key="item.id"
        class="meal-prep-card"
        :class="{
          'empty-card': item.quantity === 0,
        }"
      >
        <button
          type="button"
          class="delete-button"
          aria-label="밀프렙 삭제"
          @click="removeMealPrep(item)"
        >
          ×
        </button>

        <div class="card-top">
          <strong class="meal-prep-name">
            {{ item.name }}
          </strong>
        </div>

        <p v-if="item.quantity === 0" class="finished-label">모두 먹었어요</p>

        <div class="quantity-control">
          <button
            type="button"
            class="quantity-button"
            :disabled="item.quantity <= 0 || updatingId === item.id"
            aria-label="수량 줄이기"
            @click="changeQuantity(item, -1)"
          >
            −
          </button>

          <div class="quantity-display">
            <strong>
              {{ item.quantity }}
            </strong>

            <span> 개 남음 </span>
          </div>

          <button
            type="button"
            class="quantity-button"
            :disabled="updatingId === item.id"
            aria-label="수량 늘리기"
            @click="changeQuantity(item, 1)"
          >
            +
          </button>
        </div>
      </article>
    </div>

    <form class="add-form" @submit.prevent="addMealPrep">
      <input v-model="mealPrepName" type="text" maxlength="40" placeholder="예: 닭가슴살 볶음밥" />

      <label class="quantity-input">
        <span> 처음 수량 </span>

        <input v-model.number="initialQuantity" type="number" min="1" max="99" />
      </label>

      <button
        type="submit"
        class="add-button"
        :disabled="saving || !mealPrepName.trim() || initialQuantity < 1"
      >
        {{ saving ? '저장 중' : '추가' }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.meal-prep-view {
  --ink: #1e2a2e;
  --ink-soft: #5b6b73;
  --pink: #ff9eb1;
  --pink-dark: #e98298;
  --lavender-dark: #74668b;
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
  white-space: nowrap;
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

.meal-prep-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 18px;
}

.meal-prep-card {
  position: relative;
  display: flex;
  min-height: 190px;
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

.meal-prep-card:hover {
  transform: translateY(-3px);
  background: rgb(255 255 255 / 72%);
  box-shadow:
    0 8px 18px rgb(0 0 0 / 7%),
    inset 0 1px 0 rgb(255 255 255 / 90%);
}

.meal-prep-card.empty-card {
  opacity: 0.52;
}

.card-top {
  display: flex;
  min-height: 74px;
  flex-direction: column;
  align-items: flex-start;
  padding-right: 30px;
}

.meal-prep-name {
  display: block;
  color: var(--ink);
  font-size: 16px;
  line-height: 1.4;
  overflow-wrap: anywhere;
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

.finished-label {
  width: fit-content;
  margin: 4px 0 0;
  border-radius: 999px;
  padding: 4px 8px;
  background: rgb(178 58 46 / 8%);
  color: var(--stamp);
  font-size: 10px;
  font-weight: 700;
}

.quantity-control {
  display: grid;
  grid-template-columns: 40px 1fr 40px;
  align-items: center;
  gap: 10px;
  margin-top: auto;
  padding-top: 16px;
}

.quantity-button {
  width: 40px;
  height: 40px;
  border: 1px solid rgb(255 255 255 / 72%);
  border-radius: 50%;
  background: rgb(255 255 255 / 58%);
  color: var(--lavender-dark);
  box-shadow:
    0 3px 8px rgb(0 0 0 / 4%),
    inset 0 1px 0 rgb(255 255 255 / 85%);
  font-size: 20px;
  font-weight: 700;
  cursor: pointer;
  transition:
    transform 0.15s ease,
    background 0.15s ease;
}

.quantity-button:hover:not(:disabled) {
  transform: translateY(-1px);
  background: rgb(255 255 255 / 86%);
}

.quantity-button:active:not(:disabled) {
  transform: scale(0.96);
}

.quantity-button:disabled {
  cursor: not-allowed;
  opacity: 0.3;
}

.quantity-display {
  text-align: center;
}

.quantity-display strong {
  display: block;
  color: var(--title);
  font-size: 27px;
  line-height: 1;
}

.quantity-display span {
  display: block;
  margin-top: 5px;
  color: var(--muted);
  font-size: 10px;
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

.add-form > input {
  min-width: 180px;
  flex: 1 1 220px;
}

.add-form input {
  border: 1px solid rgb(255 255 255 / 82%);
  border-radius: 8px;
  padding: 11px 12px;
  background: rgb(255 255 255 / 72%);
  color: var(--ink);
}

.add-form input:focus {
  border-color: rgb(200 185 221 / 68%);
  outline: 3px solid rgb(200 185 221 / 16%);
}

.quantity-input {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--muted);
  font-size: 12px;
}

.quantity-input input {
  width: 75px;
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

@media (max-width: 700px) {
  .meal-prep-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .meal-prep-card {
    min-height: 180px;
    padding: 14px 13px 13px;
    border-radius: 14px;
  }

  .meal-prep-name {
    font-size: 14px;
  }

  .quantity-control {
    grid-template-columns: 36px 1fr 36px;
    gap: 7px;
  }

  .quantity-button {
    width: 36px;
    height: 36px;
  }

  .quantity-display strong {
    font-size: 24px;
  }
}

@media (max-width: 480px) {
  .section-header {
    align-items: flex-start;
  }

  .add-form {
    display: grid;
    grid-template-columns: 1fr;
  }

  .add-form > input {
    width: 100%;
    min-width: 0;
  }

  .quantity-input {
    justify-content: space-between;
  }

  .quantity-input input {
    flex: 1;
  }
}
</style>
