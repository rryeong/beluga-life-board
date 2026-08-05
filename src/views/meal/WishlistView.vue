<script setup>
import { computed, onMounted, ref } from 'vue'
import { supabase, JIBBAP_TABLE } from '@/lib/supabase'

const currentUser = ref('벨루')
const wishes = ref([])

const wishName = ref('')

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
    rating: Number(row.rating || 0),
    addedBy: row.added_by || '벨루',
    createdAt: row.created_at
      ? new Date(row.created_at).getTime()
      : 0,
  }
}

const sortedWishes = computed(() => {
  return [...wishes.value].sort((a, b) => {
    const ratingDifference = b.rating - a.rating

    if (ratingDifference !== 0) {
      return ratingDifference
    }

    return b.createdAt - a.createdAt
  })
})

const countText = computed(() => {
  if (wishes.value.length === 0) {
    return '아직 없음'
  }

  return `${wishes.value.length}개 후보`
})

async function loadWishes() {
  loading.value = true
  setStatus('먹고 싶은 메뉴를 불러오는 중...')

  const { data, error } = await supabase
    .from(JIBBAP_TABLE)
    .select('*')
    .eq('category', 'wish')
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

  wishes.value = (data || []).map(rowToItem)

  setStatus('공유 데이터와 동기화됨')
}

async function addWish() {
  const name = wishName.value.trim()

  if (!name || saving.value) return

  saving.value = true
  setStatus('메뉴를 저장하는 중...')

  const row = {
    category: 'wish',
    name,
    memo: '',
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

  wishes.value.push(rowToItem(data))
  wishName.value = ''

  setStatus('먹고 싶은 메뉴를 추가했습니다.')
}

async function setWishRating(item, ratingValue) {
  if (updatingId.value) return

  const nextRating =
    item.rating === ratingValue
      ? 0
      : ratingValue

  updatingId.value = item.id

  const { error } = await supabase
    .from(JIBBAP_TABLE)
    .update({
      rating: nextRating,
      updated_at: new Date().toISOString(),
    })
    .eq('id', item.id)

  updatingId.value = null

  if (error) {
    console.error(error)

    setStatus(
      `별점 저장 실패: ${error.message}`,
      true,
    )

    return
  }

  item.rating = nextRating

  setStatus(
    nextRating === 0
      ? '별점을 초기화했습니다.'
      : `${nextRating}점으로 저장했습니다.`,
  )
}

async function removeWish(item) {
  const shouldDelete = window.confirm(
    `"${item.name}" 메뉴를 삭제할까요?`,
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

  wishes.value = wishes.value.filter(
    (target) => target.id !== item.id,
  )

  setStatus('메뉴를 삭제했습니다.')
}

onMounted(() => {
  loadWishes()
})
</script>

<template>
  <section class="wishlist-view">
    <header class="section-header">
      <div>
        <h3>먹고 싶은 메뉴</h3>
        <p>다음에 먹고 싶은 음식을 적어두세요.</p>
      </div>

      <span class="count-text">
        {{ countText }}
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
      메뉴 후보를 불러오는 중...
    </div>

    <div
      v-else-if="sortedWishes.length === 0"
      class="empty"
    >
      먹고 싶은 메뉴를 적어보세요.
    </div>

    <div
      v-else
      class="wish-list"
    >
      <article
        v-for="item in sortedWishes"
        :key="item.id"
        class="wish-row"
      >
        <div class="wish-body">
          <strong class="wish-name">
            {{ item.name }}
          </strong>

          <div class="stars">
            <button
              v-for="ratingValue in [1, 2, 3]"
              :key="ratingValue"
              type="button"
              class="star-button"
              :class="{
                filled: ratingValue <= item.rating,
              }"
              :disabled="updatingId === item.id"
              :aria-label="`${ratingValue}점 선택`"
              @click="setWishRating(item, ratingValue)"
            >
              ★
            </button>
          </div>
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
          aria-label="메뉴 삭제"
          @click="removeWish(item)"
        >
          ×
        </button>
      </article>
    </div>

    <form
      class="add-form"
      @submit.prevent="addWish"
    >
      <input
        v-model="wishName"
        type="text"
        maxlength="40"
        placeholder="예: 마라탕, 파스타"
      />

      <button
        type="submit"
        class="add-button"
        :disabled="
          saving || !wishName.trim()
        "
      >
        {{ saving ? '저장 중' : '추가' }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.wishlist-view {
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

.count-text {
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

.wish-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
}

.wish-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border-radius: 10px;
  background: white;
  box-shadow: 0 2px 6px rgb(0 0 0 / 12%);
}

.wish-body {
  min-width: 0;
  flex: 1;
}

.wish-name {
  display: block;
  color: var(--ink);
  font-size: 15px;
  overflow-wrap: anywhere;
}

.stars {
  display: flex;
  gap: 4px;
  margin-top: 7px;
}

.star-button {
  border: 0;
  padding: 0;
  background: transparent;
  color: #e1d4da;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}

.star-button.filled {
  color: var(--pink);
}

.star-button:disabled {
  cursor: wait;
  opacity: 0.6;
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
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: white;
}

.add-form input {
  min-width: 0;
  flex: 1;
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

@media (max-width: 480px) {
  .section-header {
    align-items: flex-start;
  }

  .user-toggle {
    width: 100%;
    justify-content: center;
  }

  .wish-row {
    gap: 8px;
    padding: 12px;
  }

  .added-by {
    padding: 3px 6px;
    font-size: 10px;
  }
}
</style>