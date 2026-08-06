<script setup>
import { computed, onMounted, ref } from 'vue'
import { supabase } from '@/lib/supabase'

const TABLE_NAME = 'tennis_schedule_items'
const DAYS = ['월', '화', '수', '목', '금', '토', '일']

const statusOptions = [
  {
    value: 'go',
    label: '가자🎾',
  },
  {
    value: 'rest',
    label: '쉬자🫠',
  },
  {
    value: 'rain',
    label: '비가 와☔️',
  },
]

const viewWeekStart = ref(getMonday(new Date()))
const scheduleItems = ref([])

const loading = ref(true)
const updatingDate = ref(null)

const statusMessage = ref('')
const isError = ref(false)

function getMonday(date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  const day = result.getDay()

  result.setDate(result.getDate() - ((day + 6) % 7))

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

  const month = String(date.getMonth() + 1).padStart(2, '0')

  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function formatMonthDay(date) {
  return `${date.getMonth() + 1}/` + `${date.getDate()}`
}

function setStatus(message, error = false) {
  statusMessage.value = message
  isError.value = error
}

function getStatusLabel(status) {
  return statusOptions.find((option) => option.value === status)?.label || ''
}

const isCurrentWeek = computed(() => {
  return toDateKey(viewWeekStart.value) === toDateKey(getMonday(new Date()))
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
    const date = addDays(viewWeekStart.value, index)

    const dateKey = toDateKey(date)

    const savedItem = scheduleItems.value.find((item) => item.tennis_date === dateKey)

    return {
      day,
      date,
      dateKey,
      id: savedItem?.id || null,
      status: savedItem?.tennis_status || null,
      isToday: dateKey === toDateKey(new Date()),
    }
  })
})

const goCount = computed(() => {
  return dayCards.value.filter((item) => item.status === 'go').length
})

const restCount = computed(() => {
  return dayCards.value.filter((item) => item.status === 'rest').length
})

const rainCount = computed(() => {
  return dayCards.value.filter((item) => item.status === 'rain').length
})

async function loadSchedule() {
  loading.value = true

  setStatus('테니스 일정을 불러오는 중...')

  const startDate = toDateKey(viewWeekStart.value)

  const endDate = toDateKey(addDays(viewWeekStart.value, 6))

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

    setStatus(`불러오기 실패: ${error.message}`, true)

    return
  }

  scheduleItems.value = data || []

  setStatus('공유 데이터와 동기화됨')
}

async function selectTennisStatus(dayItem, selectedStatus) {
  if (updatingDate.value) return

  updatingDate.value = dayItem.dateKey

  const existingItem = scheduleItems.value.find((item) => item.tennis_date === dayItem.dateKey)

  // 이미 선택된 버튼을 다시 누르면 해제
  const nextStatus = dayItem.status === selectedStatus ? null : selectedStatus

  const row = {
    tennis_date: dayItem.dateKey,
    tennis_status: nextStatus,

    // 기존 is_going 컬럼과 호환
    is_going: nextStatus === 'go',

    updated_at: new Date().toISOString(),
  }

  if (existingItem) {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update(row)
      .eq('id', existingItem.id)
      .select()
      .single()

    updatingDate.value = null

    if (error) {
      console.error(error)

      setStatus(`저장 실패: ${error.message}`, true)

      return
    }

    const index = scheduleItems.value.findIndex((item) => item.id === existingItem.id)

    scheduleItems.value[index] = data
  } else {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert({
        tennis_date: dayItem.dateKey,
        tennis_status: nextStatus,
        is_going: nextStatus === 'go',
      })
      .select()
      .single()

    updatingDate.value = null

    if (error) {
      console.error(error)

      setStatus(`저장 실패: ${error.message}`, true)

      return
    }

    scheduleItems.value.push(data)
  }

  if (nextStatus) {
    setStatus(`${dayItem.day}요일을 ` + `${getStatusLabel(nextStatus)}로 저장했습니다.`)
  } else {
    setStatus(`${dayItem.day}요일 테니스 선택을 해제했습니다.`)
  }
}

async function changeWeek(amount) {
  viewWeekStart.value = addDays(viewWeekStart.value, amount * 7)

  await loadSchedule()
}

async function goThisWeek() {
  viewWeekStart.value = getMonday(new Date())

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

        <p>날짜별 테니스 계획을 선택해요.</p>
      </div>

      <div class="summary-list">
        <span class="summary go"> 가자 {{ goCount }}일 </span>

        <span class="summary rest"> 쉬자 {{ restCount }}일 </span>

        <span class="summary rain"> 비 {{ rainCount }}일 </span>
      </div>
    </header>

    <div class="week-navigation">
      <button type="button" class="week-button" @click="changeWeek(-1)">이전 주</button>

      <div class="week-title">
        {{ weekTitle }}

        <span>
          {{ isCurrentWeek ? '이번 주' : '저장된 주간 기록' }}
        </span>
      </div>

      <button type="button" class="week-button" @click="changeWeek(1)">다음 주</button>
    </div>

    <button v-if="!isCurrentWeek" type="button" class="this-week-button" @click="goThisWeek">
      이번 주로 돌아가기
    </button>

    <p class="sync-status" :class="{ error: isError }">
      {{ statusMessage }}
    </p>

    <div v-if="loading" class="loading">테니스 일정을 불러오는 중...</div>

    <div v-else class="day-grid">
      <article
        v-for="dayItem in dayCards"
        :key="dayItem.dateKey"
        class="day-card"
        :class="[
          dayItem.status,
          {
            today: dayItem.isToday,
          },
        ]"
      >
        <header>
          <div class="day-title">
            <strong> {{ dayItem.day }}요일 </strong>

            <span>
              {{ formatMonthDay(dayItem.date) }}
            </span>
          </div>

          <small v-if="dayItem.isToday"> 오늘 </small>
        </header>

        <div class="status-buttons">
          <button
            v-for="option in statusOptions"
            :key="option.value"
            type="button"
            class="status-button"
            :class="[
              option.value,
              {
                active: dayItem.status === option.value,
              },
            ]"
            :disabled="updatingDate === dayItem.dateKey"
            @click="selectTennisStatus(dayItem, option.value)"
          >
            {{ option.label }}
          </button>
        </div>
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

  --rest: #8a7895;
  --rest-light: #f1ebf4;

  --rain: #6688aa;
  --rain-light: #eaf2f9;

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

.summary-list {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.summary {
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 11px;
  font-weight: 700;
}

.summary.go {
  background: var(--green-light);
  color: var(--green);
}

.summary.rest {
  background: var(--rest-light);
  color: var(--rest);
}

.summary.rain {
  background: var(--rain-light);
  color: var(--rain);
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
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 11px;
}

.day-card {
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: white;
  box-shadow: 0 3px 10px rgb(0 0 0 / 8%);
  transition:
    background 0.2s ease,
    border-color 0.2s ease;
}

.day-card.today {
  outline: 3px solid var(--pink);
  outline-offset: 2px;
}

.day-card.go {
  border-color: rgb(93 143 104 / 35%);
  background: var(--green-light);
}

.day-card.rest {
  border-color: rgb(138 120 149 / 30%);
  background: var(--rest-light);
}

.day-card.rain {
  border-color: rgb(102 136 170 / 35%);
  background: var(--rain-light);
}

.day-card header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 15px;
}

.day-title {
  text-align: left;
}

.day-title strong {
  display: block;
  color: var(--title);
  font-size: 15px;
}

.day-title span {
  display: block;
  margin-top: 2px;
  color: var(--muted);
  font-size: 11px;
}

.day-card header small {
  border-radius: 999px;
  padding: 3px 6px;
  background: #ffe3e9;
  color: var(--pink-dark);
  font-size: 9px;
  font-weight: 700;
}

.status-buttons {
  display: grid;
  gap: 7px;
}

.status-button {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 9px;
  padding: 10px 5px;
  background: white;
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition:
    transform 0.15s ease,
    background 0.15s ease;
}

.status-button:hover:not(:disabled) {
  transform: translateY(-1px);
}

.status-button.go.active {
  border-color: var(--green);
  background: var(--green);
  color: white;
}

.status-button.rest.active {
  border-color: var(--rest);
  background: var(--rest);
  color: white;
}

.status-button.rain.active {
  border-color: var(--rain);
  background: var(--rain);
  color: white;
}

.status-button:disabled {
  cursor: wait;
  opacity: 0.5;
}

@media (max-width: 700px) {
  .day-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 480px) {
  .section-header {
    align-items: flex-start;
  }

  .summary-list {
    max-width: 160px;
  }

  .week-navigation {
    grid-template-columns: 68px 1fr 68px;
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
