<script setup>
import { computed, onMounted, ref } from 'vue'
import { supabase, JIBBAP_TABLE } from '@/lib/supabase'

const currentUser = ref('벨루')
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
    addedBy: row.added_by || '벨루',
    done: Boolean(row.done),
    mealDate: row.meal_date || null,
    createdAt: row.created_at
      ? new Date(row.created_at).getTime()
      : 0,
  }
}

const sortedItems = computed(() => {
  return [...mealPrepItems.value].sort((a, b) => {
    if (a.quantity === 0 && b.quantity !== 0) return 1
    if (a.quantity !== 0 && b.quantity === 0) return -1

    return b.createdAt - a.createdAt
  })
})

const totalQuantity = computed(() => {
  return mealPrepItems.value.reduce(
    (sum, item) => sum + item.quantity,
    0,
  )
})

const itemCountText = computed(() => {
  if (mealPrepItems.value.length === 0) {
    return '등록된 밀프렙 없음'
  }

  return `${mealPrepItems.value.length}종 · 총 ${totalQuantity.value}개`
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

    setStatus(
      `불러오기 실패: ${error.message}`,
      true,
    )

    return
  }

  mealPrepItems.value = (data || []).map(rowToItem)

  setStatus('공유 데이터와 동기화됨')
}

async function addMealPrep() {
  const name = mealPrepName.value.trim()
  const quantity = Number(initialQuantity.value)

  if (
    !name ||
    saving.value ||
    !Number.isInteger(quantity) ||
    quantity < 1
  ) {
    return
  }

  saving.value = true
  setStatus('밀프렙을 저장하는 중...')

  const row = {
    category: 'menu',
    name,
    menu_type: '밀프렙',
    quantity,
    added_by: currentUser.value,
    done: false,
    rating: 0,
  }

  const { data, error } = await supabase
    .from(JIBBAP_TABLE)
    .insert(row)
    .select()
    .single()

  saving.value = false

  if (error) {
    console.error(error)

    setStatus(
      `추가 실패: ${error.message}`,
      true,
    )

    return
  }

  mealPrepItems.value.push(rowToItem(data))

  mealPrepName.value = ''
  initialQuantity.value = 1

  setStatus('밀프렙을 추가했습니다.')
}

async function changeQuantity(item, amount) {
  if (updatingId.value) return

  const nextQuantity = Math.max(
    0,
    item.quantity + amount,
  )

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

    setStatus(
      `수량 변경 실패: ${error.message}`,
      true,
    )

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
  const shouldDelete = window.confirm(
    `"${item.name}" 밀프렙을 삭제할까요?`,
  )

  if (!shouldDelete) return

  const { error } = await supabase
    .from(JIBBAP_TABLE)
    .delete()
    .eq('id', item.id)

  if (error) {
    console.error(error)

    setStatus(
      `삭제 실패: ${error.message}`,
      true,
    )

    return
  }

  mealPrepItems.value = mealPrepItems.value.filter(
    (target) => target.id !== item.id,
  )

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

    <div class="user-toggle">
      <span class="toggle-label">
        작성자
      </span>

      <button
        type="button"
        class="user-button"
        :class="{
          'active-me': currentUser === '벨루',
        }"
        @click="currentUser = '벨루'"
      >
        벨루
      </button>

      <button
        type="button"
        class="user-button"
        :class="{
          'active-husband': currentUser === '오빠',
        }"
        @click="currentUser = '오빠'"
      >
        오빠
      </button>
    </div>

    <p
      class="sync-status"
      :class="{ error: isError }"
    >
      {{ statusMessage }}
    </p>

    <div
      v-if="loading"
      class="loading"
    >
      밀프렙을 불러오는 중...
    </div>

    <div
      v-else-if="sortedItems.length === 0"
      class="empty"
    >
      등록된 밀프렙이 없어요.
    </div>

    <div
      v-else
      class="meal-prep-grid"
    >
      <article
        v-for="item in sortedItems"
        :key="item.id"
        class="meal-prep-card"
        :class="{
          'empty-card': item.quantity === 0,
        }"
      >
        <div class="card-top">
          <div>
            <strong class="meal-prep-name">
              {{ item.name }}
            </strong>

            <span
              class="added-by"
              :class="{
                me: item.addedBy === '벨루',
                husband: item.addedBy === '오빠',
              }"
            >
              {{ item.addedBy }}
            </span>
          </div>

          <button
            type="button"
            class="delete-button"
            aria-label="밀프렙 삭제"
            @click="removeMealPrep(item)"
          >
            ×
          </button>
        </div>

        <p
          v-if="item.quantity === 0"
          class="finished-label"
        >
          모두 먹었어요
        </p>

        <div class="quantity-control">
          <button
            type="button"
            class="quantity-button"
            :disabled="
              item.quantity <= 0 ||
              updatingId === item.id
            "
            aria-label="수량 줄이기"
            @click="changeQuantity(item, -1)"
          >
            −
          </button>

          <div class="quantity-display">
            <strong>{{ item.quantity }}</strong>
            <span>개 남음</span>
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

    <form
      class="add-form"
      @submit.prevent="addMealPrep"
    >
      <input
        v-model="mealPrepName"
        type="text"
        maxlength="40"
        placeholder="예: 닭가슴살 볶음밥"
      />

      <label class="quantity-input">
        <span>처음 수량</span>

        <input
          v-model.number="initialQuantity"
          type="number"
          min="1"
          max="99"
        />
      </label>

      <button
        type="submit"
        class="add-button"
        :disabled="
          saving ||
          !mealPrepName.trim() ||
          initialQuantity < 1
        "
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
  --pink: #ff8fa3;
  --pink-dark: #e56b82;
  --teal: #3f7a6d;
  --coral: #d5674a;
  --stamp: #b23a2e;
  --title: #123847;
  --muted: #6c7b83;
  --line: rgb(23 58 71 / 14%);
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

.user-toggle {
  display: flex;
  align-items: center;
  gap: 7px;
  width: fit-content;
  margin-bottom: 14px;
  padding: 6px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: white;
}

.toggle-label {
  padding-left: 6px;
  color: var(--muted);
  font-size: 12px;
}

.user-button {
  border: 0;
  border-radius: 999px;
  padding: 7px 14px;
  background: transparent;
  color: var(--muted);
  font-weight: 700;
  cursor: pointer;
}

.user-button.active-me {
  background: var(--coral);
  color: white;
}

.user-button.active-husband {
  background: var(--teal);
  color: white;
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
  background: white;
  color: var(--muted);
  text-align: center;
}

.meal-prep-grid {
  display: grid;
  grid-template-columns: repeat(
    3,
    minmax(0, 1fr)
  );
  gap: 12px;
  margin-bottom: 16px;
}

.meal-prep-card {
  padding: 15px;
  border: 1px solid #f0e3ed;
  border-radius: 16px;
  background: white;
  box-shadow: 0 3px 9px rgb(0 0 0 / 8%);
}

.meal-prep-card.empty-card {
  opacity: 0.58;
}

.card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.meal-prep-name {
  display: block;
  color: var(--ink);
  font-size: 15px;
  overflow-wrap: anywhere;
}

.added-by {
  display: inline-block;
  margin-top: 7px;
  border-radius: 999px;
  padding: 3px 7px;
  font-size: 10px;
  font-weight: 700;
}

.added-by.me {
  background: rgb(213 103 74 / 14%);
  color: var(--coral);
}

.added-by.husband {
  background: rgb(63 122 109 / 14%);
  color: var(--teal);
}

.delete-button {
  border: 0;
  padding: 2px;
  background: transparent;
  color: var(--ink-soft);
  font-size: 18px;
  cursor: pointer;
  opacity: 0.55;
}

.finished-label {
  margin: 10px 0 0;
  color: var(--stamp);
  font-size: 11px;
  font-weight: 700;
}

.quantity-control {
  display: grid;
  grid-template-columns: 38px 1fr 38px;
  align-items: center;
  gap: 8px;
  margin-top: 18px;
}

.quantity-button {
  width: 38px;
  height: 38px;
  border: 0;
  border-radius: 50%;
  background: #f2e5f7;
  color: #553567;
  font-size: 20px;
  font-weight: 700;
  cursor: pointer;
}

.quantity-button:disabled {
  cursor: not-allowed;
  opacity: 0.35;
}

.quantity-display {
  text-align: center;
}

.quantity-display strong {
  display: block;
  color: var(--title);
  font-size: 25px;
}

.quantity-display span {
  display: block;
  margin-top: 1px;
  color: var(--muted);
  font-size: 10px;
}

.add-form {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: white;
}

.add-form > input {
  min-width: 180px;
  flex: 1 1 220px;
}

.add-form input {
  border: 1px solid #eadfe8;
  border-radius: 8px;
  padding: 11px 12px;
  background: white;
  color: var(--ink);
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
    grid-template-columns: repeat(
      2,
      minmax(0, 1fr)
    );
  }
}

@media (max-width: 480px) {
  .section-header {
    align-items: flex-start;
  }

  .user-toggle {
    width: 100%;
    justify-content: center;
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