<script setup>
import { computed, onMounted, ref } from 'vue'
import { supabase, JIBBAP_TABLE } from '@/lib/supabase'

const OWNER_NAME = '벨루'

const shoppingItems = ref([])
const itemName = ref('')
const initialQuantity = ref(1)

const loading = ref(true)
const saving = ref(false)
const updatingId = ref(null)
const transferItemId = ref(null)

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
    quantity: Number(row.quantity ?? 1),
    done: Boolean(row.done),
    createdAt: row.created_at ? new Date(row.created_at).getTime() : 0,
  }
}

const sortedItems = computed(() => {
  return [...shoppingItems.value].sort((a, b) => {
    const doneDifference = Number(a.done) - Number(b.done)

    if (doneDifference !== 0) {
      return doneDifference
    }

    return b.createdAt - a.createdAt
  })
})

const remainingCount = computed(() => {
  return shoppingItems.value.filter((item) => !item.done).length
})

const completedCount = computed(() => {
  return shoppingItems.value.filter((item) => item.done).length
})

const countText = computed(() => {
  if (shoppingItems.value.length === 0) {
    return '장보기 항목 없음'
  }

  return `${remainingCount.value}개 남음 · ${completedCount.value}개 구매 완료`
})

async function loadShoppingItems() {
  loading.value = true
  setStatus('장보기 목록을 불러오는 중...')

  const { data, error } = await supabase
    .from(JIBBAP_TABLE)
    .select('*')
    .eq('category', 'shopping')
    .order('created_at', {
      ascending: false,
    })

  loading.value = false

  if (error) {
    console.error(error)

    setStatus(`불러오기 실패: ${error.message}`, true)

    return
  }

  shoppingItems.value = (data || []).map(rowToItem)

  setStatus('공유 데이터와 동기화됨')
}

async function addShoppingItem() {
  const name = itemName.value.trim()
  const quantity = Number(initialQuantity.value)

  if (!name || saving.value || !Number.isInteger(quantity) || quantity < 1) {
    return
  }

  saving.value = true
  setStatus('장보기 항목을 저장하는 중...')

  const row = {
    category: 'shopping',
    name,
    memo: '',
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

  shoppingItems.value.push(rowToItem(data))

  itemName.value = ''
  initialQuantity.value = 1

  setStatus('장보기 목록에 추가했습니다.')
}

async function updateItem(item, changes) {
  if (updatingId.value) return false

  updatingId.value = item.id

  const { error } = await supabase
    .from(JIBBAP_TABLE)
    .update({
      ...changes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', item.id)

  updatingId.value = null

  if (error) {
    console.error(error)

    setStatus(`변경 실패: ${error.message}`, true)

    return false
  }

  Object.assign(item, changes)

  return true
}

async function changeQuantity(item, amount) {
  const nextQuantity = Math.max(1, item.quantity + amount)

  if (nextQuantity === item.quantity) return

  const success = await updateItem(item, {
    quantity: nextQuantity,
  })

  if (!success) return

  setStatus(`${item.name} 수량을 ${nextQuantity}개로 변경했습니다.`)
}

function openTransferOptions(item) {
  if (item.done) {
    cancelPurchased(item)
    return
  }

  transferItemId.value = transferItemId.value === item.id ? null : item.id

  setStatus(
    transferItemId.value
      ? '구매한 재료를 어디에 보관할지 선택하세요.'
      : '보관 위치 선택을 취소했습니다.',
  )
}

function closeTransferOptions() {
  transferItemId.value = null
  setStatus('보관 위치 선택을 취소했습니다.')
}

async function completeWithoutTransfer(item) {
  const success = await updateItem(item, {
    done: true,
  })

  if (!success) return

  transferItemId.value = null

  setStatus(`${item.name} 구매를 완료했습니다.`)
}

async function cancelPurchased(item) {
  const success = await updateItem(item, {
    done: false,
  })

  if (!success) return

  transferItemId.value = null

  setStatus(`${item.name} 구매 완료를 취소했습니다.`)
}

async function transferToStorage(item, destination) {
  if (updatingId.value) return

  const destinationLabel = destination === 'fridge' ? '냉장고' : '냉동고'

  updatingId.value = item.id

  setStatus(`${item.name}을 ${destinationLabel}에 넣는 중...`)

  const storageRow = {
    category: destination,
    name: item.name,
    memo: '장보기 목록에서 이동',
    quantity: item.quantity,
    meal_date: null,
    added_by: OWNER_NAME,
    done: false,
    rating: 0,
  }

  const { error: insertError } = await supabase.from(JIBBAP_TABLE).insert(storageRow)

  if (insertError) {
    updatingId.value = null

    console.error(insertError)

    setStatus(`${destinationLabel} 저장 실패: ${insertError.message}`, true)

    return
  }

  const { error: deleteError } = await supabase.from(JIBBAP_TABLE).delete().eq('id', item.id)

  updatingId.value = null

  if (deleteError) {
    console.error(deleteError)

    setStatus(
      `${destinationLabel}에는 저장됐지만 장보기 항목 삭제에 실패했습니다: ${deleteError.message}`,
      true,
    )

    return
  }

  shoppingItems.value = shoppingItems.value.filter((target) => target.id !== item.id)

  transferItemId.value = null

  setStatus(`${item.name} ${item.quantity}개를 ${destinationLabel}에 넣었습니다.`)
}

async function removeShoppingItem(item) {
  const shouldDelete = window.confirm(`"${item.name}" 항목을 삭제할까요?`)

  if (!shouldDelete) return

  const { error } = await supabase.from(JIBBAP_TABLE).delete().eq('id', item.id)

  if (error) {
    console.error(error)

    setStatus(`삭제 실패: ${error.message}`, true)

    return
  }

  shoppingItems.value = shoppingItems.value.filter((target) => target.id !== item.id)

  if (transferItemId.value === item.id) {
    transferItemId.value = null
  }

  setStatus('장보기 항목을 삭제했습니다.')
}

/*
 * 품목명을 클립보드에 복사한 뒤 쿠팡으로 이동
 */
async function orderFromCoupang(item) {
  try {
    await navigator.clipboard.writeText(item.name)

    setStatus(`"${item.name}"을 복사했습니다. 쿠팡 검색창에 붙여넣으세요.`)
  } catch (error) {
    console.warn('클립보드 복사 실패:', error)

    setStatus('쿠팡으로 이동합니다. 상품명을 직접 검색해주세요.')
  }

  window.location.href = 'https://www.coupang.com/'
}

/*
 * 품목명을 클립보드에 복사한 뒤 마켓컬리로 이동
 */
async function orderFromKurly(item) {
  try {
    await navigator.clipboard.writeText(item.name)

    setStatus(`"${item.name}"을 복사했습니다. 컬리 검색창에 붙여넣으세요.`)
  } catch (error) {
    console.warn('클립보드 복사 실패:', error)

    setStatus('마켓컬리로 이동합니다. 상품명을 직접 검색해주세요.')
  }

  window.location.href = 'https://www.kurly.com/'
}

onMounted(() => {
  loadShoppingItems()
})
</script>

<template>
  <section class="shopping-list-view">
    <header class="section-header">
      <div>
        <h3>장보기 목록</h3>

        <p>필요한 재료를 구매하고 보관 위치까지 관리해요.</p>
      </div>

      <span class="count-text">
        {{ countText }}
      </span>
    </header>

    <p class="sync-status" :class="{ error: isError }">
      {{ statusMessage }}
    </p>

    <div v-if="loading" class="loading">장보기 목록을 불러오는 중...</div>

    <div v-else-if="sortedItems.length === 0" class="empty">필요한 재료를 추가해보세요.</div>

    <div v-else class="shopping-list">
      <article
        v-for="item in sortedItems"
        :key="item.id"
        class="shopping-item"
        :class="{
          completed: item.done,
          expanded: transferItemId === item.id,
        }"
      >
        <div class="item-main">
          <button
            type="button"
            class="check-button"
            :class="{ checked: item.done }"
            :disabled="updatingId === item.id"
            :aria-label="item.done ? '구매 완료 취소' : '구매 완료'"
            @click="openTransferOptions(item)"
          >
            ✓
          </button>

          <div class="item-body">
            <strong class="item-name">
              {{ item.name }}
            </strong>

            <span class="item-status">
              {{
                item.done
                  ? '구매 완료'
                  : transferItemId === item.id
                    ? '보관 위치를 선택하세요'
                    : '구매 전'
              }}
            </span>

            <div v-if="!item.done" class="order-actions">
              <button
                type="button"
                class="order-button coupang"
                @click.stop="orderFromCoupang(item)"
              >
                쿠팡 주문
              </button>

              <button type="button" class="order-button kurly" @click.stop="orderFromKurly(item)">
                마켓컬리 주문
              </button>
            </div>
          </div>

          <div class="quantity-control">
            <button
              type="button"
              class="quantity-button"
              :disabled="item.done || item.quantity <= 1 || updatingId === item.id"
              aria-label="수량 줄이기"
              @click="changeQuantity(item, -1)"
            >
              −
            </button>

            <div class="quantity-display">
              <strong>
                {{ item.quantity }}
              </strong>

              <span>개</span>
            </div>

            <button
              type="button"
              class="quantity-button"
              :disabled="item.done || updatingId === item.id"
              aria-label="수량 늘리기"
              @click="changeQuantity(item, 1)"
            >
              +
            </button>
          </div>

          <button
            type="button"
            class="delete-button"
            aria-label="장보기 항목 삭제"
            @click="removeShoppingItem(item)"
          >
            ×
          </button>
        </div>

        <div v-if="transferItemId === item.id" class="transfer-panel">
          <p>구매한 재료를 어디에 넣을까요?</p>

          <div class="transfer-actions">
            <button
              type="button"
              class="transfer-button fridge"
              :disabled="updatingId === item.id"
              @click="transferToStorage(item, 'fridge')"
            >
              냉장고에 넣기
            </button>

            <button
              type="button"
              class="transfer-button freezer"
              :disabled="updatingId === item.id"
              @click="transferToStorage(item, 'freezer')"
            >
              냉동고에 넣기
            </button>

            <button
              type="button"
              class="transfer-button complete-only"
              :disabled="updatingId === item.id"
              @click="completeWithoutTransfer(item)"
            >
              구매만 완료
            </button>

            <button
              type="button"
              class="transfer-button cancel"
              :disabled="updatingId === item.id"
              @click="closeTransferOptions"
            >
              취소
            </button>
          </div>
        </div>
      </article>
    </div>

    <form class="add-form" @submit.prevent="addShoppingItem">
      <input v-model="itemName" type="text" maxlength="40" placeholder="예: 계란, 우유, 양파" />

      <label class="quantity-input">
        <span>수량</span>

        <input v-model.number="initialQuantity" type="number" min="1" max="99" />
      </label>

      <button
        type="submit"
        class="add-button"
        :disabled="saving || !itemName.trim() || initialQuantity < 1"
      >
        {{ saving ? '저장 중' : '추가' }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.shopping-list-view {
  --ink: #1e2a2e;
  --ink-soft: #5b6b73;
  --pink: #ff9eb1;
  --pink-dark: #e98298;
  --teal: #3f7a6d;
  --ice: #71859d;
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

.count-text {
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
}

.shopping-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 18px;
}

.shopping-item {
  overflow: hidden;
  border: 1px solid rgb(255 255 255 / 75%);
  border-radius: 14px;
  background: rgb(255 255 255 / 65%);
  box-shadow: 0 4px 12px rgb(0 0 0 / 5%);
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.shopping-item:hover {
  transform: translateY(-1px);
}

.shopping-item.completed {
  opacity: 0.52;
}

.shopping-item.completed .item-name {
  text-decoration: line-through;
}

.shopping-item.expanded {
  border-color: rgb(255 158 177 / 45%);
  box-shadow: 0 7px 18px rgb(0 0 0 / 7%);
}

.item-main {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
}

.check-button {
  display: flex;
  width: 28px;
  height: 28px;
  flex: none;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--ink-soft);
  border-radius: 50%;
  background: transparent;
  color: transparent;
  cursor: pointer;
}

.check-button:hover:not(:disabled) {
  border-color: var(--teal);
}

.check-button.checked {
  border-color: var(--teal);
  background: var(--teal);
  color: white;
}

.check-button:disabled {
  cursor: wait;
  opacity: 0.5;
}

.item-body {
  min-width: 0;
  flex: 1;
}

.item-name {
  display: block;
  color: var(--ink);
  font-size: 15px;
  overflow-wrap: anywhere;
}

.item-status {
  display: block;
  margin-top: 4px;
  color: var(--muted);
  font-size: 10px;
}

.order-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 9px;
}

.order-button {
  padding: 7px 10px;
  border: 0;
  border-radius: 8px;
  color: white;
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.order-button:hover {
  opacity: 0.88;
  transform: translateY(-1px);
}

.order-button.coupang {
  background: #4c72d9;
}

.order-button.kurly {
  background: #6f3f98;
}

.quantity-control {
  display: flex;
  flex: none;
  align-items: center;
  gap: 7px;
}

.quantity-display {
  min-width: 25px;
  text-align: center;
}

.quantity-display strong {
  display: block;
  color: var(--title);
  line-height: 1;
}

.quantity-display span {
  display: block;
  margin-top: 2px;
  color: var(--muted);
  font-size: 9px;
}

.quantity-button {
  width: 30px;
  height: 30px;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: white;
  color: var(--title);
  font-size: 17px;
  font-weight: 700;
  cursor: pointer;
}

.quantity-button:disabled {
  cursor: not-allowed;
  opacity: 0.35;
}

.delete-button {
  flex: none;
  padding: 4px;
  border: 0;
  background: transparent;
  color: var(--ink-soft);
  font-size: 19px;
  cursor: pointer;
  opacity: 0.55;
}

.delete-button:hover {
  color: var(--stamp);
  opacity: 1;
}

.transfer-panel {
  padding: 14px;
  border-top: 1px solid var(--line);
  background: rgb(255 255 255 / 42%);
}

.transfer-panel p {
  margin: 0 0 10px;
  color: var(--title);
  font-size: 12px;
  font-weight: 700;
  text-align: center;
}

.transfer-actions {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 7px;
}

.transfer-button {
  padding: 9px 8px;
  border: 0;
  border-radius: 9px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.transfer-button.fridge {
  background: #f2dce4;
  color: #8a5f6d;
}

.transfer-button.freezer {
  background: #dce7f2;
  color: #566f89;
}

.transfer-button.complete-only {
  background: #dcece7;
  color: #38685d;
}

.transfer-button.cancel {
  background: rgb(108 123 131 / 10%);
  color: var(--muted);
}

.transfer-button:hover:not(:disabled) {
  filter: brightness(0.97);
}

.transfer-button:disabled {
  cursor: wait;
  opacity: 0.5;
}

.add-form {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px;
  border: 1px solid rgb(255 255 255 / 72%);
  border-radius: 12px;
  background: rgb(255 255 255 / 58%);
}

.add-form > input {
  min-width: 180px;
  flex: 1 1 220px;
}

.add-form input {
  padding: 11px 12px;
  border: 1px solid rgb(255 255 255 / 82%);
  border-radius: 8px;
  background: rgb(255 255 255 / 72%);
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
  padding: 10px 18px;
  border: 0;
  border-radius: 8px;
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

  .item-main {
    align-items: flex-start;
    gap: 8px;
    padding: 12px 10px;
  }

  .item-body {
    flex: 1;
  }

  .order-actions {
    width: 100%;
    gap: 5px;
  }

  .order-button {
    flex: 1;
    padding: 8px 6px;
    font-size: 10px;
  }

  .quantity-control {
    gap: 4px;
  }

  .quantity-button {
    width: 27px;
    height: 27px;
    font-size: 16px;
  }

  .transfer-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
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
