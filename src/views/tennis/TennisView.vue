<script setup>
import { computed, onMounted, ref } from 'vue'
import { supabase } from '@/lib/supabase'

const TABLE_NAME = 'tennis_schedule_items'
const DAYS = ['월', '화', '수', '목', '금', '토', '일']

const viewWeekStart = ref(getMonday(new Date()))
const scheduleItems = ref([])

const loading = ref(true)
const updatingDate = ref(null)

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
  const end = addDays(start, 6)

  return (
    `${start.getFullYear()}년 ` +
    `${start.getMonth() + 1}월 ` +
    `${start.getDate()}일 ~ ` +
    `${end.getMonth() + 1}월 ` +
    `${end.getDate()}일`
  )
})

const dayCards = computed(() => {
  return DAYS.map((day, index) => {
    const date = addDays(
      viewWeekStart.value,
      index,
    )

    const dateKey = toDateKey(date)

    const savedItem = scheduleItems.value.find(
      (item) => item.tennis_date === dateKey,
    )

    return {
      day,
      date,
      dateKey,
      id: savedItem?.id || null,
      isGoing: Boolean(savedItem?.is_going),
      isToday:
        dateKey === toDateKey(new Date()),
    }
  })
})

const goingCount = computed(() => {
  return dayCards.value.filter(
    (item) => item.isGoing,
  ).length
})

async function loadSchedule() {
  loading.value = true
  setStatus('테니스 일정을 불러오는 중...')

  const startDate = toDateKey(
    viewWeekStart.value,
  )

  const endDate = toDateKey(
    addDays(viewWeekStart.value, 6),
  )

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .gte('tennis_date', startDate)
    .lte('tennis_date', endDate)
    .order('tennis_date', {
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

async function toggleTennis(dayItem) {
  if (updatingDate.value) return

  updatingDate.value = dayItem.dateKey

  const existingItem =
    scheduleItems.value.find(
      (item) =>
        item.tennis_date === dayItem.dateKey,
    )

  const nextValue = !dayItem.isGoing

  if (existingItem) {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update({
        is_going: nextValue,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingItem.id)
      .select()
      .single()

    updatingDate.value = null

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
        (item) => item.id === existingItem.id,
      )

    scheduleItems.value[index] = data
  } else {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert({
        tennis_date: dayItem.dateKey,
        is_going: true,
      })
      .select()
      .single()

    updatingDate.value = null

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
    nextValue
      ? `${dayItem.day}요일 테니스 간다`
      : `${dayItem.day}요일 테니스 안 간다`,
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
  <section class="tennis-view">
    <header class="section-header">
      <div>
        <h2>테니스</h2>

        <p>
          날짜별로 테니스에 갈지 체크해요.
        </p>
      </div>

      <span class="summary">
        이번 주 {{ goingCount }}일
      </span>
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
      테니스 일정을 불러오는 중...
    </div>

    <div
      v-else
      class="day-grid"
    >
      <article
        v-for="dayItem in dayCards"
        :key="dayItem.dateKey"
        class="day-card"
        :class="{
          today: dayItem.isToday,
          going: dayItem.isGoing,
        }"
      >
        <header>
          <strong>
            {{ dayItem.day }}요일
          </strong>

          <span>
            {{ formatMonthDay(dayItem.date) }}
          </span>

          <small v-if="dayItem.isToday">
            오늘
          </small>
        </header>

        <div
          class="tennis-status"
          :class="{
            going: dayItem.isGoing,
          }"
        >
         

          <strong>
            {{
              dayItem.isGoing
                ? '🎾 간다'
                : '🎾 안 간다'
            }}
          </strong>
        </div>

        <button
          type="button"
          class="toggle-button"
          :class="{
            active: dayItem.isGoing,
          }"
          :disabled="
            updatingDate === dayItem.dateKey
          "
          @click="toggleTennis(dayItem)"
        >
          {{
            dayItem.isGoing
              ? '🎾 안 가기로 변경'
              : '🎾 테니스 간다'
          }}
        </button>
      </article>
    </div>
  </section>
</template>

<style scoped>
.tennis-view {
  --pink: #ff8fa3;
  --pink-dark: #e56b82;
  --green: #5d8f68;
  --green-light: #edf8ef;
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

.section-header h2 {
  margin: 0;
  color: var(--title);
  font-size: 24px;
}

.section-header p {
  margin: 5px 0 0;
  color: var(--muted);
  font-size: 13px;
}

.summary {
  border-radius: 999px;
  padding: 6px 10px;
  background: white;
  color: var(--green);
  font-size: 12px;
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

.day-grid {
  display: grid;
  grid-template-columns: repeat(
    4,
    minmax(0, 1fr)
  );
  gap: 11px;
}

.day-card {
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: white;
  box-shadow: 0 3px 10px rgb(0 0 0 / 8%);
}

.day-card.today {
  outline: 3px solid var(--pink);
  outline-offset: 2px;
}

.day-card.going {
  border-color: rgb(93 143 104 / 35%);
  background: var(--green-light);
}

.day-card header {
  text-align: center;
}

.day-card header strong {
  display: block;
  color: var(--title);
  font-size: 15px;
}

.day-card header span {
  display: block;
  margin-top: 2px;
  color: var(--muted);
  font-size: 11px;
}

.day-card header small {
  display: block;
  margin-top: 3px;
  color: var(--pink-dark);
  font-size: 10px;
  font-weight: 700;
}

.tennis-status {
  margin: 16px 0;
  padding: 15px 5px;
  border-radius: 12px;
  background: #f7f3f8;
  color: var(--muted);
  text-align: center;
}

.tennis-status.going {
  background: white;
  color: var(--green);
}

.tennis-icon {
  display: block;
  margin-bottom: 6px;
  font-size: 29px;
}

.tennis-status strong {
  font-size: 14px;
}

.toggle-button {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 9px;
  padding: 9px 5px;
  background: white;
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.toggle-button.active {
  border-color: var(--green);
  background: var(--green);
  color: white;
}

.toggle-button:disabled {
  cursor: wait;
  opacity: 0.5;
}

@media (max-width: 700px) {
  .day-grid {
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
}
</style>