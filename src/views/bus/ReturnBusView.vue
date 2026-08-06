<script setup>
import { computed, onMounted, ref } from 'vue'
import { supabase } from '@/lib/supabase'

const TABLE_NAME = 'bus_schedule_items'
const WEEKDAYS = ['월', '화', '수', '목', '금']

const BUS_OPTIONS = [
  {
    type: '18:16',
    title: '18:16',
    description: '이른 퇴근버스',
  },
  {
    type: '19:16',
    title: '19:16',
    description: '늦은 퇴근버스',
  },
  {
    type: '빨간버스',
    title: '빨간버스',
    description: '일반 광역버스',
  },
]

const viewWeekStart = ref(getMonday(new Date()))
const scheduleItems = ref([])

const loading = ref(true)
const updatingKey = ref(null)

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
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function setStatus(message, error = false) {
  statusMessage.value = message
  isError.value = error
}

const isCurrentWeek = computed(() => {
  return toDateKey(viewWeekStart.value) === toDateKey(getMonday(new Date()))
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
    const date = addDays(viewWeekStart.value, index)

    const dateKey = toDateKey(date)

    const options = BUS_OPTIONS.map((option) => {
      const savedItem = scheduleItems.value.find(
        (item) =>
          item.bus_date === dateKey &&
          item.bus_direction === 'return' &&
          item.bus_type === option.type,
      )

      return {
        ...option,
        id: savedItem?.id || null,
        reserved: Boolean(savedItem?.reserved),
        boarded: Boolean(savedItem?.boarded),
      }
    })

    return {
      day,
      date,
      dateKey,
      options,
      isToday: dateKey === toDateKey(new Date()),
    }
  })
})

const selectedCount = computed(() => {
  return scheduleItems.value.filter((item) => item.bus_direction === 'return' && item.reserved)
    .length
})

const boardedCount = computed(() => {
  return scheduleItems.value.filter((item) => item.bus_direction === 'return' && item.boarded)
    .length
})

async function loadSchedule() {
  loading.value = true
  setStatus('퇴근버스 일정을 불러오는 중...')

  const startDate = toDateKey(viewWeekStart.value)

  const endDate = toDateKey(addDays(viewWeekStart.value, 4))

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('bus_direction', 'return')
    .gte('bus_date', startDate)
    .lte('bus_date', endDate)
    .order('bus_date', {
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

async function selectBus(dayItem, busOption) {
  if (updatingKey.value) return

  const key = `${dayItem.dateKey}-${busOption.type}`

  updatingKey.value = key

  const existing = scheduleItems.value.find(
    (item) =>
      item.bus_date === dayItem.dateKey &&
      item.bus_direction === 'return' &&
      item.bus_type === busOption.type,
  )

  if (existing?.reserved) {
    const { error } = await supabase.from(TABLE_NAME).delete().eq('id', existing.id)

    updatingKey.value = null

    if (error) {
      console.error(error)

      setStatus(`선택 취소 실패: ${error.message}`, true)

      return
    }

    scheduleItems.value = scheduleItems.value.filter((item) => item.id !== existing.id)

    setStatus(`${dayItem.day}요일 ${busOption.title} 선택을 취소했습니다.`)

    return
  }

  const otherSelectedItems = scheduleItems.value.filter(
    (item) => item.bus_date === dayItem.dateKey && item.bus_direction === 'return' && item.reserved,
  )

  if (otherSelectedItems.length > 0) {
    const ids = otherSelectedItems.map((item) => item.id)

    const { error: deleteError } = await supabase.from(TABLE_NAME).delete().in('id', ids)

    if (deleteError) {
      updatingKey.value = null

      console.error(deleteError)

      setStatus(`기존 선택 삭제 실패: ${deleteError.message}`, true)

      return
    }

    scheduleItems.value = scheduleItems.value.filter((item) => !ids.includes(item.id))
  }

  const newRow = {
    bus_date: dayItem.dateKey,
    bus_direction: 'return',
    bus_type: busOption.type,
    reserved: true,
    boarded: false,
  }

  const { data, error } = await supabase.from(TABLE_NAME).insert(newRow).select().single()

  updatingKey.value = null

  if (error) {
    console.error(error)

    setStatus(`저장 실패: ${error.message}`, true)

    return
  }

  scheduleItems.value.push(data)

  setStatus(`${dayItem.day}요일 ${busOption.title}를 선택했습니다.`)
}

async function toggleBoarded(dayItem, busOption) {
  if (!busOption.id || !busOption.reserved || updatingKey.value) {
    return
  }

  const key = `${dayItem.dateKey}-${busOption.type}-boarded`

  updatingKey.value = key

  const nextBoarded = !busOption.boarded

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update({
      boarded: nextBoarded,
      updated_at: new Date().toISOString(),
    })
    .eq('id', busOption.id)
    .select()
    .single()

  updatingKey.value = null

  if (error) {
    console.error(error)

    setStatus(`탑승 상태 저장 실패: ${error.message}`, true)

    return
  }

  const index = scheduleItems.value.findIndex((item) => item.id === busOption.id)

  if (index !== -1) {
    scheduleItems.value[index] = data
  }

  setStatus(
    nextBoarded ? `${dayItem.day}요일 탑승 완료` : `${dayItem.day}요일 탑승 완료를 취소했습니다.`,
  )
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
  <section class="return-view">
    <header class="section-header">
      <div>
        <h3>퇴근버스</h3>

        <p>평일마다 이용할 퇴근버스를 선택해요.</p>
      </div>

      <div class="summary">
        <span> 선택 {{ selectedCount }}/5 </span>

        <span> 탑승 {{ boardedCount }}/5 </span>
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

    <div v-if="loading" class="loading">퇴근버스 일정을 불러오는 중...</div>

    <div v-else class="weekday-list">
      <article
        v-for="dayItem in weekdayCards"
        :key="dayItem.dateKey"
        class="day-card"
        :class="{
          today: dayItem.isToday,
        }"
      >
        <header class="day-header">
          <div>
            <strong> {{ dayItem.day }}요일 </strong>

            <span>
              {{ formatMonthDay(dayItem.date) }}
            </span>
          </div>

          <small v-if="dayItem.isToday"> 오늘 </small>
        </header>

        <div class="bus-options">
          <article
            v-for="option in dayItem.options"
            :key="option.type"
            class="bus-option"
            :class="{
              selected: option.reserved,
              boarded: option.boarded,
            }"
          >
            <button
              type="button"
              class="select-button"
              :disabled="updatingKey === `${dayItem.dateKey}-${option.type}`"
              @click="selectBus(dayItem, option)"
            >
              <span class="selection-circle"> ✓ </span>

              <span class="option-text">
                <strong>
                  {{ option.title }}
                </strong>

                <small>
                  {{ option.description }}
                </small>
              </span>
            </button>

            <button
              type="button"
              class="boarded-button"
              :class="{
                checked: option.boarded,
              }"
              :disabled="
                !option.reserved || updatingKey === `${dayItem.dateKey}-${option.type}-boarded`
              "
              @click="toggleBoarded(dayItem, option)"
            >
              {{ option.boarded ? '탑승 완료' : '탑승 체크' }}
            </button>
          </article>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.return-view {
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

.weekday-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
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

.day-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}

.day-header strong {
  color: var(--title);
  font-size: 16px;
}

.day-header span {
  margin-left: 7px;
  color: var(--muted);
  font-size: 11px;
}

.day-header small {
  color: var(--pink-dark);
  font-size: 10px;
  font-weight: 700;
}

.bus-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 9px;
}

.bus-option {
  padding: 9px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fcf9fd;
}

.bus-option.selected {
  border-color: rgb(63 122 109 / 35%);
  background: rgb(63 122 109 / 8%);
}

.bus-option.boarded {
  background: #e9f7f1;
}

.select-button {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  border: 0;
  padding: 3px;
  background: transparent;
  color: var(--muted);
  text-align: left;
  cursor: pointer;
}

.selection-circle {
  display: flex;
  width: 20px;
  height: 20px;
  flex: none;
  align-items: center;
  justify-content: center;
  border: 2px solid #aaa1ac;
  border-radius: 50%;
  color: transparent;
  font-size: 10px;
}

.bus-option.selected .selection-circle {
  border-color: var(--teal);
  background: var(--teal);
  color: white;
}

.option-text {
  min-width: 0;
}

.option-text strong {
  display: block;
  color: var(--title);
  font-size: 14px;
}

.option-text small {
  display: block;
  margin-top: 2px;
  color: var(--muted);
  font-size: 9px;
}

.boarded-button {
  width: 100%;
  margin-top: 9px;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 7px;
  background: white;
  color: var(--muted);
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
}

.boarded-button.checked {
  border-color: var(--teal);
  background: var(--teal);
  color: white;
}

.boarded-button:disabled {
  cursor: not-allowed;
  opacity: 0.38;
}

@media (max-width: 680px) {
  .bus-options {
    grid-template-columns: 1fr;
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
