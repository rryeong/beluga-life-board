<script setup>
import { computed, onMounted, ref } from 'vue'
import { supabase, JIBBAP_TABLE } from '@/lib/supabase'

const currentUser = ref('벨루')

const fridgeItems = ref([])

const ingredientName = ref('')
const ingredientMemo = ref('')

const loading = ref(true)
const saving = ref(false)

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
    addedBy: row.added_by || '벨루',
    createdAt: row.created_at
      ? new Date(row.created_at).getTime()
      : 0,
  }
}

const sortedItems = computed(() => {
  return [...fridgeItems.value].sort(
    (a, b) => b.createdAt - a.createdAt,
  )
})

const itemCountText = computed(() => {
  if (fridgeItems.value.length === 0) {
    return '아직 없음'
  }

  return `${fridgeItems.value.length}개 보관 중`
})

async function loadFridgeItems() {
  loading.value = true
  setStatus('냉장고 재료를 불러오는 중...')

  const { data, error } = await supabase
    .from(JIBBAP_TABLE)
    .select('*')
    .eq('category', 'fridge')
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

  fridgeItems.value = (data || []).map(rowToItem)

  setStatus('공유 데이터와 동기화됨')
}

async function addIngredient() {
  const name = ingredientName.value.trim()
  const memo = ingredientMemo.value.trim()

  if (!name || saving.value) return

  saving.value = true
  setStatus('재료를 저장하는 중...')

  const row = {
    category: 'fridge',
    name,
    memo,
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

  fridgeItems.value.push(rowToItem(data))

  ingredientName.value = ''
  ingredientMemo.value = ''

  setStatus('냉장고 재료를 추가했습니다.')
}

async function removeIngredient(item) {
  const shouldDelete = window.confirm(
    `"${item.name}" 재료를 삭제할까요?`,
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

  fridgeItems.value = fridgeItems.value.filter(
    (target) => target.id !== item.id,
  )

  setStatus('재료를 삭제했습니다.')
}

onMounted(() => {
  loadFridgeItems()
})
</script>

<template>
  <section class="fridge-view">
    <header class="section-header">
      <div>
        <h3>냉장고 속 재료</h3>
        <p>냉장 보관 중인 재료를 관리해요.</p>
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
      냉장고 문 여는 중...
    </div>

    <div
      v-else-if="sortedItems.length === 0"
      class="empty"
    >
      냉장고가 비어 있어요.
    </div>

    <div
      v-else
      class="ingredient-list"
    >
      <article
        v-for="item in sortedItems"
        :key="item.id"
        class="shelf-row"
        :class="{
          'me-added': item.addedBy === '벨루',
        }"
      >
        <div class="shelf-body">
          <strong class="shelf-name">
            {{ item.name }}
          </strong>

          <p
            v-if="item.memo"
            class="shelf-memo"
          >
            {{ item.memo }}
          </p>
        </div>

        <span
          class="added-by"
          :class="{
            me: item.addedBy === '벨루',
            husband: item.addedBy === '오빠',
          }"
        >
          {{ item.addedBy }}
        </span>

        <button
          type="button"
          class="delete-button"
          aria-label="재료 삭제"
          @click="removeIngredient(item)"
        >
          ×
        </button>
      </article>
    </div>

    <form
      class="add-form"
      @submit.prevent="addIngredient"
    >
      <input
        v-model="ingredientName"
        type="text"
        maxlength="40"
        placeholder="예: 삼겹살 500g"
      />

      <input
        v-model="ingredientMemo"
        type="text"
        maxlength="40"
        placeholder="메모 선택, 예: 유통기한 8/12"
      />

      <button
        type="submit"
        class="add-button"
        :disabled="
          saving || !ingredientName.trim()
        "
      >
        {{ saving ? '저장 중' : '추가' }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.fridge-view {
  --paper: #fff0f5;
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

.ingredient-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
}

.shelf-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border-left: 4px solid var(--teal);
  border-radius: 10px;
  background: white;
  box-shadow: 0 2px 6px rgb(0 0 0 / 12%);
}

.shelf-row.me-added {
  border-left-color: var(--coral);
}

.shelf-body {
  min-width: 0;
  flex: 1;
}

.shelf-name {
  display: block;
  color: var(--ink);
  font-size: 15px;
  overflow-wrap: anywhere;
}

.shelf-memo {
  margin: 3px 0 0;
  color: var(--ink-soft);
  font-size: 12px;
  overflow-wrap: anywhere;
}

.added-by {
  flex: none;
  border-radius: 999px;
  padding: 4px 8px;
  font-size: 11px;
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
  flex: none;
  border: 0;
  padding: 4px;
  background: transparent;
  color: var(--ink-soft);
  font-size: 18px;
  cursor: pointer;
  opacity: 0.55;
}

.delete-button:hover {
  color: var(--stamp);
  opacity: 1;
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

.add-form input {
  min-width: 180px;
  flex: 1 1 220px;
  border: 1px solid #eadfe8;
  border-radius: 8px;
  padding: 11px 12px;
  background: white;
  color: var(--ink);
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

@media (max-width: 640px) {
  .section-header {
    align-items: flex-start;
  }

  .user-toggle {
    width: 100%;
    justify-content: center;
  }

  .shelf-row {
    gap: 8px;
    padding: 12px;
  }

  .added-by {
    padding: 3px 6px;
    font-size: 10px;
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