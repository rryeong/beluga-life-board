<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { supabase } from '@/lib/supabase'

const TABLE_NAME = 'commute_schedules'

const currentWeekStart = ref(getMonday(new Date()))
const schedules = ref({})

const loading = ref(false)
const savingDate = ref('')
const statusMessage = ref('')
const isError = ref(false)

const startOptions = [
  { value: null, label: '미정' },
  { value: 'early', label: '일찍' },
  { value: 'regular', label: '정시' },
]

const endOptions = [
  { value: null, label: '미정' },
  { value: 'regular', label: '정시' },
  { value: 'late', label: '늦게' },
]

const dayNames = ['월요일', '화요일', '수요일', '목요일', '금요일']

function getMonday(date) {
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)

  const day = target.getDay()
  const difference = day === 0 ? -6 : 1 - day

  target.setDate(target.getDate() + difference)

  return target
}

function addDays(date, amount) {
  const result = new Date(date)
  result.setDate(result.getDate() + amount)
  return result
}

function formatDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function formatShortDate(date) {
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function isSameDate(first, second) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  )
}

function setStatus(message, error = false) {
  statusMessage.value = message
  isError.value = error
}

const weekDays = computed(() => {
  return dayNames.map((name, index) => {
    const date = addDays(currentWeekStart.value, index)
    const dateKey = formatDateKey(date)

    return {
      name,
      date,
      dateKey,
      shortDate: formatShortDate(date),
      isToday: isSameDate(date, new Date()),
      schedule: schedules.value[dateKey] || {
        commute_start: null,
        commute_end: null,
      },
    }
  })
})

const weekLabel = computed(() => {
  const start = currentWeekStart.value
  const end = addDays(start, 6)

  return (
    `${start.getFullYear()}년 ` +
    `${start.getMonth() + 1}월 ${start.getDate()}일 ` +
    `~ ${end.getMonth() + 1}월 ${end.getDate()}일`
  )
})

async function loadSchedules() {
  loading.value = true
  setStatus('출퇴근 일정을 불러오는 중...')

  const startDate = formatDateKey(currentWeekStart.value)
  const endDate = formatDateKey(addDays(currentWeekStart.value, 6))

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('person', 'beluga')
    .gte('schedule_date', startDate)
    .lte('schedule_date', endDate)

  loading.value = false

  if (error) {
    console.error(error)
    setStatus(`불러오기 실패: ${error.message}`, true)
    return
  }

  const nextSchedules = {}

  for (const row of data || []) {
    nextSchedules[row.schedule_date] = {
      id: row.id,
      commute_start: row.commute_start,
      commute_end: row.commute_end,
    }
  }

  schedules.value = nextSchedules
  setStatus('공유 일정과 동기화됨')
}

async function saveSchedule(dateKey, changes) {
  if (savingDate.value) return

  savingDate.value = dateKey

  const current = schedules.value[dateKey] || {
    commute_start: null,
    commute_end: null,
  }

  const nextSchedule = {
    ...current,
    ...changes,
  }

  const row = {
    person: 'beluga',
    schedule_date: dateKey,
    commute_start: nextSchedule.commute_start,
    commute_end: nextSchedule.commute_end,
    work_location: null,
    work_shift: null,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .upsert(row, {
      onConflict: 'person,schedule_date',
    })
    .select()
    .single()

  savingDate.value = ''

  if (error) {
    console.error(error)
    setStatus(`저장 실패: ${error.message}`, true)
    return
  }

  schedules.value = {
    ...schedules.value,
    [dateKey]: {
      id: data.id,
      commute_start: data.commute_start,
      commute_end: data.commute_end,
    },
  }

  setStatus(`${dateKey} 일정을 저장했습니다.`)
}

function moveWeek(amount) {
  currentWeekStart.value = addDays(currentWeekStart.value, amount * 7)
}

function moveToCurrentWeek() {
  currentWeekStart.value = getMonday(new Date())
}

watch(currentWeekStart, loadSchedules)

onMounted(loadSchedules)
</script>

<template>
  <section class="beluga-commute-view">
    <header class="section-header">
      <div>
        <h3>벨루 출퇴근</h3>
        <p>월요일부터 금요일까지 출퇴근 시간을 기록해요.</p>
      </div>
    </header>

    <div class="week-controller">
      <button type="button" @click="moveWeek(-1)">‹ 이전 주</button>

      <div class="week-title">
        <strong>{{ weekLabel }}</strong>

        <button type="button" class="today-button" @click="moveToCurrentWeek">이번 주</button>
      </div>

      <button type="button" @click="moveWeek(1)">다음 주 ›</button>
    </div>

    <p class="sync-status" :class="{ error: isError }">
      {{ statusMessage }}
    </p>

    <div v-if="loading" class="loading">일정을 불러오는 중...</div>

    <div v-else class="schedule-grid">
      <article
        v-for="day in weekDays"
        :key="day.dateKey"
        class="day-card"
        :class="{ today: day.isToday }"
      >
        <header class="day-header">
          <strong>{{ day.name }}</strong>
          <span>{{ day.shortDate }}</span>
        </header>

        <span v-if="day.isToday" class="today-label"> 오늘 </span>

        <section class="schedule-section">
          <h4>출근</h4>

          <div class="option-grid">
            <button
              v-for="option in startOptions"
              :key="option.value === null ? 'start-none' : option.value"
              type="button"
              :class="{
                selected: day.schedule.commute_start === option.value,
              }"
              :disabled="savingDate === day.dateKey"
              @click="
                saveSchedule(day.dateKey, {
                  commute_start: option.value,
                })
              "
            >
              {{ option.label }}
            </button>
          </div>
        </section>

        <section class="schedule-section">
          <h4>퇴근</h4>

          <div class="option-grid">
            <button
              v-for="option in endOptions"
              :key="option.value === null ? 'end-none' : option.value"
              type="button"
              :class="{
                selected: day.schedule.commute_end === option.value,
              }"
              :disabled="savingDate === day.dateKey"
              @click="
                saveSchedule(day.dateKey, {
                  commute_end: option.value,
                })
              "
            >
              {{ option.label }}
            </button>
          </div>
        </section>
      </article>
    </div>
  </section>
</template>

<style scoped>
.beluga-commute-view {
  --title: #493957;
  --text: #443b49;
  --muted: #7d7182;
  --pink: #f1d8e7;
  --pink-strong: #d895b9;
  --line: rgb(73 57 87 / 12%);
}

.section-header {
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

.week-controller {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.week-controller > button,
.today-button {
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 9px 12px;
  background: rgb(255 255 255 / 68%);
  color: var(--text);
  cursor: pointer;
}

.week-title {
  text-align: center;
}

.week-title strong {
  display: block;
  color: var(--title);
  font-size: 14px;
}

.today-button {
  margin-top: 6px;
  padding: 5px 10px;
  font-size: 11px;
}

.sync-status {
  min-height: 18px;
  margin: 0 0 10px;
  color: var(--muted);
  font-size: 11px;
  text-align: center;
}

.sync-status.error {
  color: #b23a2e;
}

.loading {
  padding: 50px 0;
  color: var(--muted);
  text-align: center;
}

.schedule-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}

.day-card {
  position: relative;
  padding: 14px;
  border: 1px solid rgb(255 255 255 / 75%);
  border-radius: 16px;
  background: rgb(255 255 255 / 58%);
  box-shadow: 0 4px 12px rgb(0 0 0 / 5%);
}

.day-card.today {
  border: 2px solid var(--pink-strong);
  background: rgb(255 244 250 / 86%);
}

.day-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--title);
}

.day-header span {
  color: var(--muted);
  font-size: 11px;
}

.today-label {
  display: inline-block;
  margin-top: 7px;
  border-radius: 999px;
  padding: 3px 7px;
  background: var(--pink);
  color: var(--title);
  font-size: 9px;
  font-weight: 700;
}

.schedule-section {
  margin-top: 14px;
}

.schedule-section h4 {
  margin: 0 0 7px;
  color: var(--muted);
  font-size: 11px;
}

.option-grid {
  display: grid;
  gap: 5px;
}

.option-grid button {
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 8px 5px;
  background: rgb(255 255 255 / 68%);
  color: var(--text);
  font-size: 11px;
  cursor: pointer;
}

.option-grid button.selected {
  border-color: var(--pink-strong);
  background: var(--pink);
  color: var(--title);
  font-weight: 800;
}

.option-grid button:disabled {
  cursor: wait;
  opacity: 0.5;
}

@media (max-width: 850px) {
  .schedule-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 520px) {
  .week-controller {
    grid-template-columns: 1fr 1fr;
  }

  .week-title {
    grid-column: 1 / -1;
    grid-row: 1;
  }

  .schedule-grid {
    grid-template-columns: 1fr;
  }
}
</style>
