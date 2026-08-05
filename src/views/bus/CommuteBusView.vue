<script setup>
import { computed, onMounted, ref } from 'vue'
import { supabase } from '@/lib/supabase'

const TABLE_NAME = 'bus_schedule_items'
const WEEKDAYS = ['월', '화', '수', '목', '금']

const viewWeekStart = ref(getMonday(new Date()))
const scheduleItems = ref([])

const loading = ref(true)
const updatingKey = ref(null)

const statusMessage = ref('')
const isError = ref(false)

function getMonday(date) {
  const result = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  )

  const day = result.getDay()

  result.setDate(
    result.getDate() - ((day + 6) % 7),
  )

  result.setHours(0, 0, 0, 0)

  return result
}

function addDays(date, amount) {
  const result = new Date(date)

  result.setDate(result.getDate() + amount)

  return result
}

function toDateKey(date) {
  const year = date.getFullYear()
  const month = String(
    date.getMonth() + 1,
  ).padStart(2, '0')

  const day = String(
    date.getDate(),
  ).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function formatMonthDay(date) {
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function setStatus(message, error = false) {
  statusMessage.value = message
  isError.value = error
}

const isCurrentWeek = computed(() => {
  return (
    toDateKey(viewWeekStart.value) ===
    toDateKey(getMonday(new Date()))
  )
})

const weekTitle = computed(() => {
  const start = viewWeekStart.value
  const end = addDays(start, 4)

  return (
    `${start.getFullYear()}년 ` +
    `${start.getMonth() + 1}월 ` +
    `${start.getDate()}일 ~ ` +
    `${end.getMonth() + 1}월 ` +
    `${end.getDate()}일`
  )
})

const weekdayCards = computed(() => {
  return WEEKDAYS.map((day, index) => {
    const date = addDays(
      viewWeekStart.value,
      index,
    )

    const dateKey = toDateKey(date)

    const savedItem =
      scheduleItems.value.find(
        (item) =>
          item.bus_date === dateKey &&
          item.bus_direction ===
            'commute' &&
          item.bus_type === 'P9242',
      )

    return {
      day,
      date,
      dateKey,
      id: savedItem?.id || null,
      reserved:
        savedItem?.reserved || false,
      boarded:
        savedItem?.boarded || false,
      isToday:
        dateKey === toDateKey(new Date()),
    }
  })
})

const reservedCount = computed(() => {
  return weekdayCards.value.filter(
    (item) => item.reserved,
  ).length
})

const boardedCount = computed(() => {
  return weekdayCards.value.filter(
    (item) => item.boarded,
  ).length
})

async function loadSchedule() {
  loading.value = true
  setStatus('출근버스 일정을 불러오는 중...')

  const startDate = toDateKey(
    viewWeekStart.value,
  )

  const endDate = toDateKey(
    addDays(viewWeekStart.value, 4),
  )

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('bus_direction', 'commute')
    .gte('bus_date', startDate)
    .lte('bus_date', endDate)
    .order('bus_date', {
      ascending: true,
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

  scheduleItems.value = data || []

  setStatus('공유 데이터와 동기화됨')
}

async function saveBusState(
  item,
  field,
  value,
) {
  const key = `${item.dateKey}-${field}`

  if (updatingKey.value) return

  updatingKey.value = key

  const existing =
    scheduleItems.value.find(
      (target) =>
        target.bus_date ===
          item.dateKey &&
        target.bus_direction ===
          'commute' &&
        target.bus_type === 'P9242',
    )

  if (existing) {
    const updates = {
      [field]: value,
      updated_at:
        new Date().toISOString(),
    }

    if (
      field === 'reserved' &&
      value === false
    ) {
      updates.boarded = false
    }

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update(updates)
      .eq('id', existing.id)
      .select()
      .single()

    updatingKey.value = null

    if (error) {
      console.error(error)

      setStatus(
        `저장 실패: ${error.message}`,
        true,
      )

      return
    }

    const index =
      scheduleItems.value.findIndex(
        (target) =>
          target.id === existing.id,
      )

    scheduleItems.value[index] = data
  } else {
    const newRow = {
      bus_date: item.dateKey,
      bus_direction: 'commute',
      bus_type: 'P9242',
      reserved:
        field === 'reserved'
          ? value
          : true,
      boarded:
        field === 'boarded'
          ? value
          : false,
    }

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert(newRow)
      .select()
      .single()

    updatingKey.value = null

    if (error) {
      console.error(error)

      setStatus(
        `저장 실패: ${error.message}`,
        true,
      )

      return
    }

    scheduleItems.value.push(data)
  }

  setStatus(
    field === 'reserved'
      ? value
        ? `${item.day}요일 예약 완료`
        : `${item.day}요일 예약 취소`
      : value
        ? `${item.day}요일 탑승 완료`
        : `${item.day}요일 탑승 취소`,
  )
}

async function toggleReserved(item) {
  await saveBusState(
    item,
    'reserved',
    !item.reserved,
  )
}

async function toggleBoarded(item) {
  if (!item.reserved && !item.boarded) {
    await saveBusState(
      item,
      'boarded',
      true,
    )

    return
  }

  await saveBusState(
    item,
    'boarded',
    !item.boarded,
  )
}

async function changeWeek(amount) {
  viewWeekStart.value = addDays(
    viewWeekStart.value,
    amount * 7,
  )

  await loadSchedule()
}

async function goThisWeek() {
  viewWeekStart.value = getMonday(
    new Date(),
  )

  await loadSchedule()
}

onMounted(() => {
  loadSchedule()
})
</script>

<template>
  <section class="commute-view">
    <header class="section-header">
      <div>
        <h3>출근버스</h3>

        <p>
          평일 P9242 예약과 탑승을
          체크해요.
        </p>
      </div>

      <div class="summary">
        <span>
          예약 {{ reservedCount }}/5
        </span>

        <span>
          탑승 {{ boardedCount }}/5
        </span>
      </div>
    </header>

    <div class="week-navigation">
      <button
        type="button"
        class="week-button"
        @click="changeWeek(-1)"
      >
        이전 주
      </button>

      <div class="week-title">
        {{ weekTitle }}

        <span>
          {{
            isCurrentWeek
              ? '이번 주'
              : '저장된 주간 기록'
          }}
        </span>
      </div>

      <button
        type="button"
        class="week-button"
        @click="changeWeek(1)"
      >
        다음 주
      </button>
    </div>

    <button
      v-if="!isCurrentWeek"
      type="button"
      class="this-week-button"
      @click="goThisWeek"
    >
      이번 주로 돌아가기
    </button>

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
      버스 일정을 불러오는 중...
    </div>

    <div
      v-else
      class="weekday-grid"
    >
      <article
        v-for="item in weekdayCards"
        :key="item.dateKey"
        class="bus-card"
        :class="{
          today: item.isToday,
          completed: item.boarded,
        }"
      >
        <header class="card-header">
          <strong>
            {{ item.day }}요일
          </strong>

          <span>
            {{ formatMonthDay(item.date) }}
          </span>

          <small v-if="item.isToday">
            오늘
          </small>
        </header>

        <div class="route">
          <strong>P9242</strong>

          <span>
            서천센트럴파크원
            → 금토천
          </span>
        </div>

        <div class="check-list">
          <button
            type="button"
            class="check-button"
            :class="{
              checked: item.reserved,
            }"
            :disabled="
              updatingKey ===
              `${item.dateKey}-reserved`
            "
            @click="toggleReserved(item)"
          >
            <span class="check-circle">
              ✓
            </span>

            <span>예약 완료</span>
          </button>

          <button
            type="button"
            class="check-button"
            :class="{
              checked: item.boarded,
            }"
            :disabled="
              updatingKey ===
              `${item.dateKey}-boarded`
            "
            @click="toggleBoarded(item)"
          >
            <span class="check-circle">
              ✓
            </span>

            <span>탑승 완료</span>
          </button>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.commute-view {
  --pink: #ff8fa3;
  --pink-dark: #e56b82;
  --lavender: #eadcf5;
  --teal: #3f7a6d;
  --title: #123847;
  --muted: #6c7b83;
  --stamp: #b23a2e;
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

.summary {
  display: flex;
  gap: 7px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.summary span {
  border-radius: 999px;
  padding: 5px 9px;
  background: white;
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
}

.week-navigation {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: white;
  box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
}

.week-button {
  border: 0;
  border-radius: 9px;
  padding: 9px 12px;
  background: #ffc0cb;
  color: var(--title);
  font-weight: 700;
  cursor: pointer;
}

.week-title {
  color: var(--title);
  font-size: 14px;
  font-weight: 700;
  text-align: center;
}

.week-title span {
  display: block;
  margin-top: 2px;
  color: var(--muted);
  font-size: 10px;
  font-weight: 500;
}

.this-week-button {
  display: block;
  margin: 0 auto 12px;
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 7px 14px;
  background: white;
  color: var(--title);
  font-weight: 700;
  cursor: pointer;
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

.weekday-grid {
  display: grid;
  grid-template-columns: repeat(
    5,
    minmax(0, 1fr)
  );
  gap: 10px;
}

.bus-card {
  padding: 13px;
  border: 1px solid var(--line);
  border-radius: 15px;
  background: white;
  box-shadow: 0 3px 10px rgb(0 0 0 / 8%);
}

.bus-card.today {
  outline: 3px solid var(--pink);
  outline-offset: 2px;
}

.bus-card.completed {
  background: #f1faf7;
}

.card-header {
  margin-bottom: 13px;
  text-align: center;
}

.card-header strong {
  display: block;
  color: var(--title);
  font-size: 15px;
}

.card-header span {
  display: block;
  margin-top: 2px;
  color: var(--muted);
  font-size: 11px;
}

.card-header small {
  display: inline-block;
  margin-top: 4px;
  color: var(--pink-dark);
  font-size: 10px;
  font-weight: 700;
}

.route {
  min-height: 73px;
  margin-bottom: 13px;
  padding: 10px 7px;
  border-radius: 10px;
  background: #f8f2fb;
  text-align: center;
}

.route strong {
  display: block;
  color: #553567;
  font-size: 16px;
}

.route span {
  display: block;
  margin-top: 5px;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.5;
}

.check-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.check-button {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 9px;
  padding: 8px;
  background: white;
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.check-circle {
  display: flex;
  width: 18px;
  height: 18px;
  flex: none;
  align-items: center;
  justify-content: center;
  border: 2px solid #9b929d;
  border-radius: 50%;
  color: transparent;
  font-size: 10px;
}

.check-button.checked {
  border-color: rgb(63 122 109 / 35%);
  background: rgb(63 122 109 / 8%);
  color: var(--teal);
}

.check-button.checked .check-circle {
  border-color: var(--teal);
  background: var(--teal);
  color: white;
}

.check-button:disabled {
  cursor: wait;
  opacity: 0.5;
}

@media (max-width: 760px) {
  .weekday-grid {
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

  .summary {
    flex-direction: column;
    align-items: flex-end;
  }

  .week-navigation {
    grid-template-columns:
      68px 1fr 68px;
    gap: 5px;
    padding: 8px;
  }

  .week-button {
    padding: 8px 4px;
    font-size: 11px;
  }

  .week-title {
    font-size: 11px;
  }

  .weekday-grid {
    grid-template-columns: repeat(
      2,
      minmax(0, 1fr)
    );
  }
}
</style>