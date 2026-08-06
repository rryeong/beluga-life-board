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

const locationOptions = [
  { value: 'office', label: '사무실' },
  { value: 'pyeongtaek', label: '평택' },
  { value: 'cheongju', label: '청주' },
  { value: 'icheon', label: '이천' },
  { value: 'overseas', label: '해외출장' },
  { value: 'off', label: 'OFF' },
]

const shiftOptions = [
  { value: 'day', label: '주간' },
  { value: 'night', label: '야간' },
]

const shiftLocations = ['pyeongtaek', 'cheongju', 'icheon']

const dayNames = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일']

function getMonday(date) {
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  const day = target.getDay()
  const difference = day === 0 ? -6 : 1 - day

  target.setDate(target.getDate() + difference)

  target.setHours(0, 0, 0, 0)

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
  return `${date.getMonth() + 1}/` + `${date.getDate()}`
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

function needsShift(location) {
  return shiftLocations.includes(location)
}

function getLocationLabel(location) {
  return locationOptions.find((option) => option.value === location)?.label || ''
}

function getShiftLabel(shift) {
  if (shift === 'day') {
    return '주간'
  }

  if (shift === 'night') {
    return '야간'
  }

  return ''
}

function getScheduleSummary(schedule) {
  if (!schedule?.work_location) {
    return '미정'
  }

  const locationLabel = getLocationLabel(schedule.work_location)

  const shiftLabel = getShiftLabel(schedule.work_shift)

  if (needsShift(schedule.work_location) && shiftLabel) {
    return `${locationLabel} ` + `${shiftLabel}`
  }

  if (needsShift(schedule.work_location)) {
    return `${locationLabel} 미정`
  }

  return locationLabel
}

function getSummaryClass(schedule) {
  if (!schedule?.work_location) {
    return 'unset'
  }

  if (schedule.work_location === 'off') {
    return 'off'
  }

  if (schedule.work_location === 'overseas') {
    return 'overseas'
  }

  if (schedule.work_location === 'office') {
    return 'office'
  }

  if (schedule.work_shift === 'night') {
    return 'night'
  }

  if (schedule.work_shift === 'day') {
    return 'day'
  }

  return 'unset'
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
        work_location: null,
        work_shift: null,
      },
    }
  })
})

const weekLabel = computed(() => {
  const start = currentWeekStart.value

  const end = addDays(start, 6)

  return (
    `${start.getFullYear()}년 ` +
    `${start.getMonth() + 1}월 ` +
    `${start.getDate()}일 ~ ` +
    `${end.getMonth() + 1}월 ` +
    `${end.getDate()}일`
  )
})

async function loadSchedules() {
  loading.value = true

  setStatus('근무 일정을 불러오는 중...')

  const startDate = formatDateKey(currentWeekStart.value)

  const endDate = formatDateKey(addDays(currentWeekStart.value, 6))

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('person', 'oppa')
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

      work_location: row.work_location,

      work_shift: row.work_shift,
    }
  }

  schedules.value = nextSchedules

  setStatus('공유 일정과 동기화됨')
}

async function saveSchedule(dateKey, changes) {
  if (savingDate.value) return

  savingDate.value = dateKey

  const current = schedules.value[dateKey] || {
    work_location: null,
    work_shift: null,
  }

  const nextSchedule = {
    ...current,
    ...changes,
  }

  if (!needsShift(nextSchedule.work_location)) {
    nextSchedule.work_shift = null
  }

  const row = {
    person: 'oppa',

    schedule_date: dateKey,

    commute_start: null,
    commute_end: null,

    work_location: nextSchedule.work_location,

    work_shift: nextSchedule.work_shift,

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

      work_location: data.work_location,

      work_shift: data.work_shift,
    },
  }

  setStatus(`${dateKey} ` + `${getScheduleSummary(data)} ` + `일정을 저장했습니다.`)
}

async function selectLocation(day, location) {
  const nextShift =
    needsShift(location) && day.schedule.work_location === location ? day.schedule.work_shift : null

  await saveSchedule(day.dateKey, {
    work_location: location,
    work_shift: nextShift,
  })
}

async function selectShift(day, shift) {
  if (!needsShift(day.schedule.work_location)) {
    return
  }

  await saveSchedule(day.dateKey, {
    work_shift: shift,
  })
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
  <section class="oppa-commute-view">
    <header class="section-header">
      <div>
        <h3>오빠 근무 일정</h3>

        <p>근무 위치를 선택하고, 평택·청주·이천은 주간과 야간을 구분해요.</p>
      </div>
    </header>

    <div class="week-controller">
      <button type="button" @click="moveWeek(-1)">‹ 이전 주</button>

      <div class="week-title">
        <strong>
          {{ weekLabel }}
        </strong>

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
        :class="{
          today: day.isToday,
        }"
      >
        <header class="day-header">
          <div class="day-title-area">
            <div class="day-title-line">
              <strong>
                {{ day.name }}
              </strong>

              <span class="day-date">
                {{ day.shortDate }}
              </span>

              <span class="schedule-badge" :class="getSummaryClass(day.schedule)">
                {{ getScheduleSummary(day.schedule) }}
              </span>
            </div>
          </div>

          <span v-if="day.isToday" class="today-label"> 오늘 </span>
        </header>

        <section class="location-section">
          <h4>근무 위치</h4>

          <div class="location-grid">
            <button
              v-for="option in locationOptions"
              :key="option.value"
              type="button"
              :class="{
                selected: day.schedule.work_location === option.value,
              }"
              :disabled="savingDate === day.dateKey"
              @click="selectLocation(day, option.value)"
            >
              {{ option.label }}
            </button>
          </div>
        </section>

        <section v-if="needsShift(day.schedule.work_location)" class="shift-section">
          <h4>
            {{ getLocationLabel(day.schedule.work_location) }}
            근무
          </h4>

          <div class="shift-grid">
            <button
              v-for="option in shiftOptions"
              :key="option.value"
              type="button"
              :class="{
                selected: day.schedule.work_shift === option.value,
              }"
              :disabled="savingDate === day.dateKey"
              @click="selectShift(day, option.value)"
            >
              {{ option.label }}
            </button>
          </div>

          <p v-if="!day.schedule.work_shift" class="shift-guide">주간 또는 야간을 선택하세요.</p>
        </section>

        <p v-else-if="day.schedule.work_location === 'office'" class="summary-box office">
          사무실 근무
        </p>

        <p v-else-if="day.schedule.work_location === 'overseas'" class="summary-box overseas">
          해외출장
        </p>

        <p v-else-if="day.schedule.work_location === 'off'" class="summary-box off">쉬는 날</p>

        <p v-else class="summary-box empty">일정을 선택하세요.</p>
      </article>
    </div>
  </section>
</template>

<style scoped>
.oppa-commute-view {
  --title: #493957;
  --text: #443b49;
  --muted: #7d7182;

  --pink: #f1d8e7;
  --pink-strong: #d895b9;
  --pink-light: #fff6fb;

  --blue: #dbe7f3;
  --blue-strong: #7891aa;

  --green: #dcebe5;

  --purple: #eee2f5;
  --purple-strong: #684c78;

  --night: #e4def2;
  --night-strong: #63547e;

  --line: #e7dbea;

  --shadow: 0 7px 20px rgb(73 57 87 / 9%);
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
  padding: 10px;

  border: 1px solid var(--line);
  border-radius: 16px;

  background: white;

  box-shadow: 0 3px 12px rgb(73 57 87 / 6%);
}

.week-controller > button,
.today-button {
  border: 1px solid var(--line);
  border-radius: 10px;

  padding: 9px 12px;

  background: #f6eff9;
  color: var(--text);

  font-weight: 700;

  cursor: pointer;
}

.week-controller > button:hover,
.today-button:hover {
  background: var(--pink);
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
  padding: 5px 11px;

  font-size: 11px;
}

.sync-status {
  min-height: 18px;
  margin: 0 0 12px;

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

  grid-template-columns: repeat(2, minmax(0, 1fr));

  gap: 14px;
}

.day-card {
  min-height: 255px;

  padding: 17px;

  border: 1px solid var(--line);
  border-radius: 20px;

  background: white;

  box-shadow: var(--shadow);

  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease;
}

.day-card:hover {
  transform: translateY(-2px);

  box-shadow: 0 10px 25px rgb(73 57 87 / 12%);
}

.day-card.today {
  border: 2px solid var(--pink-strong);

  background: var(--pink-light);

  box-shadow: 0 9px 24px rgb(216 149 185 / 20%);
}

.day-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;

  gap: 8px;

  padding-bottom: 12px;

  border-bottom: 1px solid rgb(73 57 87 / 8%);
}

.day-title-area {
  min-width: 0;
  flex: 1;
}

.day-title-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;

  gap: 7px;
}

.day-title-line strong {
  color: var(--title);
  font-size: 16px;
}

.day-date {
  color: var(--muted);
  font-size: 12px;
}

.schedule-badge {
  display: inline-flex;
  align-items: center;

  min-height: 23px;

  border-radius: 999px;

  padding: 4px 10px;

  font-size: 10px;
  font-weight: 800;

  white-space: nowrap;
}

.schedule-badge.unset {
  background: rgb(125 113 130 / 10%);

  color: var(--muted);
}

.schedule-badge.office {
  background: var(--blue);
  color: #455f78;
}

.schedule-badge.day {
  background: #e8eff7;
  color: #48647f;
}

.schedule-badge.night {
  background: var(--night);
  color: var(--night-strong);
}

.schedule-badge.overseas {
  background: var(--purple);
  color: var(--purple-strong);
}

.schedule-badge.off {
  background: var(--green);
  color: #426b5b;
}

.today-label {
  flex: none;

  border-radius: 999px;

  padding: 4px 9px;

  background: var(--pink);
  color: var(--title);

  font-size: 10px;
  font-weight: 800;
}

.location-section,
.shift-section {
  margin-top: 15px;
}

.location-section h4,
.shift-section h4 {
  margin: 0 0 9px;

  color: var(--muted);
  font-size: 11px;
}

.location-grid {
  display: grid;

  grid-template-columns: repeat(3, minmax(0, 1fr));

  gap: 7px;
}

.location-grid button,
.shift-grid button {
  border: 1px solid var(--line);
  border-radius: 10px;

  padding: 10px 5px;

  background: white;
  color: var(--text);

  font-size: 11px;
  font-weight: 700;

  cursor: pointer;

  transition:
    transform 0.15s ease,
    background 0.15s ease,
    border-color 0.15s ease;
}

.location-grid button:hover:not(:disabled),
.shift-grid button:hover:not(:disabled) {
  transform: translateY(-1px);

  background: #f7f2f9;
}

.location-grid button.selected {
  border-color: var(--blue-strong);

  background: var(--blue);
  color: #455f78;

  font-weight: 800;
}

.shift-section {
  border-top: 1px solid rgb(73 57 87 / 8%);

  padding-top: 14px;
}

.shift-grid {
  display: grid;

  grid-template-columns: repeat(2, minmax(0, 1fr));

  gap: 8px;
}

.shift-grid button.selected {
  border-color: var(--pink-strong);

  background: var(--pink);
  color: var(--title);

  font-weight: 800;
}

.location-grid button:disabled,
.shift-grid button:disabled {
  cursor: wait;
  opacity: 0.5;
}

.shift-guide {
  margin: 9px 0 0;

  color: var(--muted);
  font-size: 10px;
  text-align: center;
}

.summary-box {
  margin: 17px 0 0;

  border-radius: 12px;

  padding: 12px;

  font-size: 12px;
  font-weight: 800;
  text-align: center;
}

.summary-box.office {
  background: var(--blue);
  color: #455f78;
}

.summary-box.overseas {
  background: var(--purple);
  color: var(--purple-strong);
}

.summary-box.off {
  background: var(--green);
  color: #426b5b;
}

.summary-box.empty {
  background: rgb(125 113 130 / 8%);

  color: var(--muted);
}

@media (max-width: 700px) {
  .schedule-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .day-card {
    min-height: 0;
    padding: 15px;
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

  .week-controller > button {
    width: 100%;
  }

  .location-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .day-title-line strong {
    font-size: 15px;
  }

  .schedule-badge {
    padding: 4px 8px;
    font-size: 9px;
  }
}

@media (max-width: 380px) {
  .location-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
