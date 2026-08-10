<script setup>
import { computed, onMounted, ref } from 'vue'

import { supabase } from '@/lib/supabase'

const scheduleDate = ref('')
const title = ref('')
const place = ref('')
const memo = ref('')

const schedules = ref([])

const loading = ref(false)
const adding = ref(false)
const message = ref('')

const todayString = computed(() => {
  const today = new Date()

  const year = today.getFullYear()

  const month = String(today.getMonth() + 1).padStart(2, '0')

  const day = String(today.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
})

const upcomingCount = computed(() => {
  return schedules.value.filter((schedule) => schedule.schedule_date >= todayString.value).length
})

function formatDate(dateString) {
  if (!dateString) {
    return ''
  }

  const [year, month, day] = dateString.split('-')

  return `${year}.${month}.${day}`
}

function isPastSchedule(schedule) {
  return schedule.schedule_date < todayString.value
}

function isTodaySchedule(schedule) {
  return schedule.schedule_date === todayString.value
}

async function loadSchedules() {
  loading.value = true
  message.value = ''

  const { data, error } = await supabase
    .from('date_schedules')
    .select('*')
    .order('schedule_date', {
      ascending: true,
    })
    .order('created_at', {
      ascending: true,
    })

  if (error) {
    console.error(error)

    message.value = '데이트 일정을 불러오지 못했어요.'

    loading.value = false

    return
  }

  schedules.value = data ?? []

  loading.value = false
}

async function addSchedule() {
  const trimmedTitle = title.value.trim()

  const trimmedPlace = place.value.trim()

  const trimmedMemo = memo.value.trim()

  if (!scheduleDate.value || !trimmedTitle || adding.value) {
    return
  }

  adding.value = true
  message.value = ''

  const { data, error } = await supabase
    .from('date_schedules')
    .insert({
      schedule_date: scheduleDate.value,

      title: trimmedTitle,

      place: trimmedPlace || null,

      memo: trimmedMemo || null,
    })
    .select()
    .single()

  if (error) {
    console.error(error)

    message.value = '데이트 일정을 추가하지 못했어요.'

    adding.value = false

    return
  }

  schedules.value.push(data)

  schedules.value.sort((a, b) => {
    return a.schedule_date.localeCompare(b.schedule_date)
  })

  scheduleDate.value = ''
  title.value = ''
  place.value = ''
  memo.value = ''

  adding.value = false
}

async function removeSchedule(id) {
  const confirmed = window.confirm('이 일정을 삭제할까요?')

  if (!confirmed) {
    return
  }

  const { error } = await supabase.from('date_schedules').delete().eq('id', id)

  if (error) {
    console.error(error)

    message.value = '일정을 삭제하지 못했어요.'

    return
  }

  schedules.value = schedules.value.filter((schedule) => schedule.id !== id)
}

onMounted(() => {
  loadSchedules()
})
</script>

<template>
  <section class="schedule-view">
    <header class="section-header">
      <div>
        <h2>데이트 일정</h2>

        <p>앞으로 함께할 데이트 일정을 기록해두는 공간이에요.</p>
      </div>

      <span class="count"> 예정 {{ upcomingCount }}개 </span>
    </header>

    <form class="add-form" @submit.prevent="addSchedule">
      <input v-model="scheduleDate" type="date" />

      <input v-model="title" type="text" maxlength="60" placeholder="데이트 제목" />

      <input v-model="place" type="text" maxlength="60" placeholder="장소 (선택)" />

      <input v-model="memo" type="text" maxlength="120" placeholder="메모 (선택)" />

      <button type="submit" :disabled="!scheduleDate || !title.trim() || adding">
        {{ adding ? '추가 중...' : '추가' }}
      </button>
    </form>

    <p v-if="message" class="message">
      {{ message }}
    </p>

    <div v-if="loading" class="empty-state">불러오는 중...</div>

    <div v-else-if="schedules.length" class="schedule-list">
      <article
        v-for="schedule in schedules"
        :key="schedule.id"
        class="schedule-card"
        :class="{
          past: isPastSchedule(schedule),

          today: isTodaySchedule(schedule),
        }"
      >
        <div class="card-top">
          <div>
            <span v-if="isTodaySchedule(schedule)" class="today-badge"> 오늘 </span>

            <span v-else-if="isPastSchedule(schedule)" class="past-badge"> 지난 일정 </span>

            <span v-else class="upcoming-badge"> 예정 </span>
          </div>

          <button
            type="button"
            class="delete-button"
            aria-label="삭제"
            @click="removeSchedule(schedule.id)"
          >
            ×
          </button>
        </div>

        <p class="date">
          {{ formatDate(schedule.schedule_date) }}
        </p>

        <h3>
          {{ schedule.title }}
        </h3>

        <p v-if="schedule.place" class="place">📍 {{ schedule.place }}</p>

        <p v-if="schedule.memo" class="memo">
          {{ schedule.memo }}
        </p>
      </article>
    </div>

    <div v-else class="empty-state">아직 등록한 데이트 일정이 없어요.</div>
  </section>
</template>

<style scoped>
.schedule-view {
  --title: #493957;
  --text: #443b49;
  --muted: #817487;
  --pink: #f3dce9;
  --pink-strong: #d895b9;
  --line: #e9ddea;

  width: 100%;
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

  font-size: 22px;
}

.section-header p {
  margin: 5px 0 0;

  color: var(--muted);

  font-size: 13px;
}

.count {
  flex-shrink: 0;

  padding: 6px 10px;

  border-radius: 999px;

  background: var(--pink);

  color: var(--title);

  font-size: 12px;
  font-weight: 700;
}

.add-form {
  display: grid;

  grid-template-columns:
    1.1fr
    1.5fr
    1.5fr
    2fr
    auto;

  gap: 8px;

  margin-bottom: 18px;
  padding: 12px;

  border: 1px solid var(--line);
  border-radius: 16px;

  background: white;

  box-shadow: 0 4px 14px rgb(73 57 87 / 5%);
}

.add-form input {
  min-width: 0;

  padding: 11px 12px;

  border: 1px solid var(--line);
  border-radius: 11px;

  background: white;

  color: var(--text);

  font-size: 13px;

  outline: none;
}

.add-form input:focus {
  border-color: var(--pink-strong);
}

.add-form button {
  padding: 10px 18px;

  border: 0;
  border-radius: 11px;

  background: var(--pink-strong);

  color: white;

  font-size: 13px;
  font-weight: 700;

  cursor: pointer;
}

.add-form button:disabled {
  opacity: 0.45;

  cursor: not-allowed;
}

.message {
  margin: -4px 0 16px;

  color: #b45c75;

  font-size: 13px;

  text-align: center;
}

.schedule-list {
  display: grid;

  grid-template-columns: repeat(2, minmax(0, 1fr));

  gap: 12px;
}

.schedule-card {
  padding: 15px;

  border: 1px solid var(--line);
  border-radius: 17px;

  background: white;

  box-shadow: 0 5px 16px rgb(73 57 87 / 7%);
}

.schedule-card.today {
  border: 2px solid var(--pink-strong);

  background: #fff8fb;
}

.schedule-card.past {
  opacity: 0.58;
}

.card-top {
  display: flex;

  align-items: center;
  justify-content: space-between;

  margin-bottom: 10px;
}

.today-badge,
.upcoming-badge,
.past-badge {
  display: inline-block;

  padding: 4px 8px;

  border-radius: 999px;

  font-size: 10px;
  font-weight: 700;
}

.today-badge {
  background: #f5d4e5;

  color: #a34e79;
}

.upcoming-badge {
  background: #eee6f4;

  color: #665175;
}

.past-badge {
  background: #efedef;

  color: #817a83;
}

.date {
  margin: 0 0 5px;

  color: var(--muted);

  font-size: 12px;
  font-weight: 700;
}

.schedule-card h3 {
  margin: 0 0 8px;

  color: var(--title);

  font-size: 17px;
}

.place {
  margin: 0 0 7px;

  color: var(--text);

  font-size: 12px;
}

.memo {
  margin: 0;

  color: var(--muted);

  font-size: 12px;
  line-height: 1.6;
}

.delete-button {
  padding: 3px 5px;

  border: 0;

  background: transparent;

  color: var(--muted);

  font-size: 20px;

  cursor: pointer;
}

.empty-state {
  padding: 45px 20px;

  border: 1px dashed var(--line);
  border-radius: 16px;

  background: rgb(255 255 255 / 45%);

  color: var(--muted);

  font-size: 14px;

  text-align: center;
}

@media (max-width: 760px) {
  .add-form {
    grid-template-columns: repeat(2, 1fr);
  }

  .add-form button {
    grid-column: 1 / -1;
  }
}

@media (max-width: 640px) {
  .section-header {
    align-items: flex-start;
  }

  .add-form {
    grid-template-columns: 1fr;
  }

  .add-form button {
    grid-column: auto;

    width: 100%;
  }

  .schedule-list {
    grid-template-columns: 1fr;
  }
}
</style>
