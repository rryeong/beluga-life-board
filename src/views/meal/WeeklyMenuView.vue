<script setup>
import { computed, onMounted, ref } from 'vue'
import { supabase, JIBBAP_TABLE } from '@/lib/supabase'

const DAYS = ['월', '화', '수', '목', '금', '토', '일']

const currentUser = ref('벨루')
const menus = ref([])
const selectedMenuId = ref(null)
const selectedDay = ref(null)
const viewWeekStart = ref(getMonday(new Date()))

const menuName = ref('')
const menuType = ref('집밥')

const loading = ref(true)
const saving = ref(false)
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
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function parseDateKey(key) {
  const [year, month, day] = key
    .split('-')
    .map(Number)

  return new Date(year, month - 1, day)
}

function formatMonthDay(date) {
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function setStatus(message, error = false) {
  statusMessage.value = message
  isError.value = error
}

function dayDate(day) {
  const index = DAYS.indexOf(day)

  return addDays(viewWeekStart.value, index)
}

function todayDateKey() {
  return toDateKey(new Date())
}

function rowToItem(row) {
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    memo: row.memo || '',
    type: row.menu_type || '집밥',
    mealDate: row.meal_date || null,
    day: row.meal_date
      ? DAYS[
          (parseDateKey(row.meal_date).getDay() + 6) % 7
        ]
      : null,
    addedBy: row.added_by || '벨루',
    done: Boolean(row.done),
    rating: Number(row.rating || 0),
    createdAt: row.created_at
      ? new Date(row.created_at).getTime()
      : 0,
  }
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

  const first =
    `${start.getFullYear()}년 ` +
    `${start.getMonth() + 1}월 ` +
    `${start.getDate()}일`

  const last =
    start.getFullYear() === end.getFullYear()
      ? `${end.getMonth() + 1}월 ${end.getDate()}일`
      : `${end.getFullYear()}년 ${end.getMonth() + 1}월 ${end.getDate()}일`

  return `${first} ~ ${last}`
})

const weekSubtitle = computed(() => {
  return isCurrentWeek.value
    ? '이번 주'
    : '저장된 주간 기록'
})

const dayOptions = computed(() => {
  return DAYS.map((day) => {
    const date = dayDate(day)

    return {
      day,
      label: `${day}요일 ${formatMonthDay(date)}`,
      date,
      dateKey: toDateKey(date),
    }
  })
})

const visibleMenus = computed(() => {
  const start = toDateKey(viewWeekStart.value)
  const end = toDateKey(
    addDays(viewWeekStart.value, 6),
  )

  return menus.value.filter((menu) => {
    return (
      menu.mealDate &&
      menu.mealDate >= start &&
      menu.mealDate <= end
    )
  })
})

const completedCount = computed(() => {
  return visibleMenus.value.filter(
    (menu) => menu.done,
  ).length
})

const menuCountText = computed(() => {
  if (visibleMenus.value.length === 0) {
    return '이번 주 없음'
  }

  return (
    `${completedCount.value}/` +
    `${visibleMenus.value.length} 완료`
  )
})

const calendarDays = computed(() => {
  return dayOptions.value.map((option) => {
    const items = visibleMenus.value
      .filter(
        (menu) =>
          menu.mealDate === option.dateKey,
      )
      .sort((a, b) => {
        const doneDifference =
          Number(a.done) - Number(b.done)

        if (doneDifference !== 0) {
          return doneDifference
        }

        return a.createdAt - b.createdAt
      })

    return {
      ...option,
      items,
      isToday:
        option.dateKey === todayDateKey(),
      isSelected:
        option.day === selectedDay.value,
    }
  })
})

function setInitialSelectedDay() {
  if (selectedDay.value) return

  if (isCurrentWeek.value) {
    const todayIndex =
      (new Date().getDay() + 6) % 7

    selectedDay.value = DAYS[todayIndex]
  } else {
    selectedDay.value = '월'
  }
}

async function loadMenus() {
  loading.value = true
  setStatus('Supabase에서 불러오는 중...')

  const { data, error } = await supabase
    .from(JIBBAP_TABLE)
    .select('*')
    .eq('category', 'menu')
    .order('created_at', {
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

  menus.value = (data || []).map(rowToItem)

  setInitialSelectedDay()
  setStatus('공유 데이터와 동기화됨')
}

async function addMenu() {
  const name = menuName.value.trim()

  if (!name || saving.value) return

  if (!selectedDay.value) {
    setInitialSelectedDay()
  }

  saving.value = true
  setStatus('메뉴를 저장하는 중...')

  const row = {
    category: 'menu',
    name,
    menu_type: menuType.value,
    meal_date: toDateKey(
      dayDate(selectedDay.value),
    ),
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

  menus.value.push(rowToItem(data))
  menuName.value = ''

  setStatus('메뉴를 저장했습니다.')
}

async function toggleMenuDone(menu) {
  const nextDone = !menu.done

  const { error } = await supabase
    .from(JIBBAP_TABLE)
    .update({
      done: nextDone,
      updated_at: new Date().toISOString(),
    })
    .eq('id', menu.id)

  if (error) {
    console.error(error)

    setStatus(
      `수정 실패: ${error.message}`,
      true,
    )

    return
  }

  menu.done = nextDone

  setStatus(
    nextDone
      ? '완료 처리했습니다.'
      : '완료를 취소했습니다.',
  )
}

async function removeMenu(menu) {
  const shouldDelete = window.confirm(
    `"${menu.name}" 메뉴를 삭제할까요?`,
  )

  if (!shouldDelete) return

  const { error } = await supabase
    .from(JIBBAP_TABLE)
    .delete()
    .eq('id', menu.id)

  if (error) {
    console.error(error)

    setStatus(
      `삭제 실패: ${error.message}`,
      true,
    )

    return
  }

  menus.value = menus.value.filter(
    (item) => item.id !== menu.id,
  )

  if (selectedMenuId.value === menu.id) {
    selectedMenuId.value = null
  }

  setStatus('메뉴를 삭제했습니다.')
}

function selectMenuForMove(menu) {
  selectedMenuId.value =
    selectedMenuId.value === menu.id
      ? null
      : menu.id

  if (selectedMenuId.value) {
    setStatus(
      '이동할 요일을 선택하세요.',
    )
  } else {
    setStatus(
      '메뉴 이동 선택을 취소했습니다.',
    )
  }
}

async function selectDay(day) {
  if (!DAYS.includes(day)) return

  selectedDay.value = day

  if (!selectedMenuId.value) return

  const menu = menus.value.find(
    (item) =>
      item.id === selectedMenuId.value,
  )

  if (!menu) {
    selectedMenuId.value = null
    return
  }

  const newDate = toDateKey(dayDate(day))

  if (menu.mealDate === newDate) {
    selectedMenuId.value = null
    setStatus('같은 요일입니다.')
    return
  }

  const { error } = await supabase
    .from(JIBBAP_TABLE)
    .update({
      meal_date: newDate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', menu.id)

  if (error) {
    console.error(error)

    setStatus(
      `이동 실패: ${error.message}`,
      true,
    )

    return
  }

  menu.mealDate = newDate
  menu.day = day
  selectedMenuId.value = null

  setStatus('메뉴 날짜를 이동했습니다.')
}

function changeWeek(amount) {
  viewWeekStart.value = addDays(
    viewWeekStart.value,
    amount * 7,
  )

  selectedDay.value = '월'
  selectedMenuId.value = null

  setStatus(
    amount > 0
      ? '다음 주를 표시합니다.'
      : '이전 주를 표시합니다.',
  )
}

function goThisWeek() {
  viewWeekStart.value = getMonday(
    new Date(),
  )

  const todayIndex =
    (new Date().getDay() + 6) % 7

  selectedDay.value = DAYS[todayIndex]
  selectedMenuId.value = null

  setStatus('이번 주로 이동했습니다.')
}

onMounted(() => {
  setInitialSelectedDay()
  loadMenus()
})
</script>

<template>
  <section class="weekly-menu-view">
    <header class="section-header">
      <div>
        <h3>이번 주 메뉴</h3>
        <p>요일별 집밥과 밀프렙을 관리해요.</p>
      </div>

      <span class="menu-count">
        {{ menuCountText }}
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
          'active-me':
            currentUser === '벨루',
        }"
        @click="currentUser = '벨루'"
      >
        벨루
      </button>

      <button
        type="button"
        class="user-button"
        :class="{
          'active-husband':
            currentUser === '오빠',
        }"
        @click="currentUser = '오빠'"
      >
        오빠
      </button>
    </div>

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

        <span class="week-subtitle">
          {{ weekSubtitle }}
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

    <p
      v-if="selectedMenuId"
      class="move-guide"
    >
      선택한 메뉴를 이동하려면
      <strong>
        원하는 요일 제목
      </strong>
      을 누르세요.
    </p>

    <div
      v-if="loading"
      class="loading"
    >
      메뉴를 불러오는 중입니다.
    </div>

    <div
      v-else
      class="calendar"
    >
      <article
        v-for="day in calendarDays"
        :key="day.dateKey"
        class="day-column"
      >
        <button
          type="button"
          class="day-header"
          :class="{
            selected: day.isSelected,
          }"
          @click="selectDay(day.day)"
        >
          {{ day.day }}

          <span class="day-date">
            {{ formatMonthDay(day.date) }}
          </span>

          <span
            v-if="day.isToday"
            class="today-label"
          >
            오늘
          </span>
        </button>

        <div class="day-body">
          <div
            v-if="day.items.length === 0"
            class="day-empty"
          >
            메뉴 없음
          </div>

          <article
            v-for="menu in day.items"
            :key="menu.id"
            class="menu-note"
            :class="{
              done: menu.done,
              'move-selected':
                selectedMenuId === menu.id,
            }"
            @click="selectMenuForMove(menu)"
          >
            <span
              v-if="menu.done"
              class="done-stamp"
            >
              완료
            </span>

            <button
              type="button"
              class="check-button"
              :class="{
                checked: menu.done,
              }"
              :aria-label="
                menu.done
                  ? '완료 취소'
                  : '완료 표시'
              "
              @click.stop="
                toggleMenuDone(menu)
              "
            >
              ✓
            </button>

            <div class="menu-body">
              <strong class="menu-name">
                {{ menu.name }}
              </strong>

              <div class="menu-meta">
                <span
                  class="menu-badge"
                  :class="{
                    'meal-prep':
                      menu.type === '밀프렙',
                  }"
                >
                  {{ menu.type }}
                </span>

                <span
                  class="user-magnet"
                  :class="{
                    me:
                      menu.addedBy ===
                      '벨루',
                    husband:
                      menu.addedBy ===
                      '오빠',
                  }"
                  :title="
                    `${menu.addedBy} 추가`
                  "
                />
              </div>
            </div>

            <button
              type="button"
              class="delete-button"
              aria-label="메뉴 삭제"
              @click.stop="
                removeMenu(menu)
              "
            >
              ×
            </button>
          </article>
        </div>
      </article>
    </div>

    <form
      class="add-form"
      @submit.prevent="addMenu"
    >
      <input
        v-model="menuName"
        type="text"
        maxlength="40"
        placeholder="예: 김치찌개, 닭볶음탕"
      />

      <select v-model="selectedDay">
        <option
          v-for="option in dayOptions"
          :key="option.day"
          :value="option.day"
        >
          {{ option.label }}
        </option>
      </select>

      <select v-model="menuType">
        <option value="집밥">
          집밥
        </option>

        <option value="밀프렙">
          밀프렙
        </option>
      </select>

      <button
        type="submit"
        class="add-button"
        :disabled="
          saving || !menuName.trim()
        "
      >
        {{ saving ? '저장 중' : '추가' }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.weekly-menu-view {
  --paper: #fff0f5;
  --ink: #1e2a2e;
  --ink-soft: #5b6b73;
  --pink: #ff8fa3;
  --pink-dark: #e56b82;
  --teal: #3f7a6d;
  --teal-dark: #2e5c52;
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

.menu-count {
  color: var(--muted);
  font-size: 13px;
}

.user-toggle {
  display: flex;
  align-items: center;
  gap: 7px;
  width: fit-content;
  margin-bottom: 16px;
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
  font-size: 15px;
  font-weight: 700;
  text-align: center;
}

.week-subtitle {
  display: block;
  margin-top: 2px;
  color: var(--muted);
  font-size: 11px;
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

.move-guide {
  margin: 0 0 12px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
}

.move-guide strong {
  color: var(--pink-dark);
}

.loading {
  padding: 50px 0;
  color: var(--muted);
  text-align: center;
}

.calendar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  padding: 3px 3px 14px;
  overflow-x: auto;
  scroll-snap-type: x proximity;
}

.day-column {
  display: flex;
  flex: 0 0 128px;
  flex-direction: column;
  gap: 7px;
  scroll-snap-align: start;
}

.day-header {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 9px;
  padding: 8px 3px;
  background: var(--paper);
  color: var(--title);
  font-weight: 700;
  cursor: pointer;
}

.day-header.selected {
  outline: 3px solid var(--pink);
  outline-offset: 2px;
  background: #ffc0cb;
}

.day-date {
  display: block;
  margin-top: 2px;
  color: var(--muted);
  font-size: 10.5px;
  font-weight: 500;
}

.today-label {
  display: block;
  margin-top: 1px;
  color: var(--pink-dark);
  font-size: 10px;
}

.day-body {
  display: flex;
  min-height: 36px;
  flex-direction: column;
  gap: 7px;
}

.day-empty {
  border: 1px dashed var(--line);
  border-radius: 8px;
  padding: 12px 4px;
  color: var(--muted);
  font-size: 11px;
  text-align: center;
}

.menu-note {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  overflow: hidden;
  padding: 10px 9px;
  border-radius: 7px;
  background: white;
  box-shadow:
    0 2px 4px rgb(0 0 0 / 12%),
    0 5px 12px rgb(0 0 0 / 12%);
  cursor: pointer;
}

.menu-note.done {
  opacity: 0.7;
}

.menu-note.move-selected {
  outline: 3px solid var(--coral);
  outline-offset: 2px;
}

.check-button {
  display: flex;
  width: 19px;
  height: 19px;
  flex: none;
  align-items: center;
  justify-content: center;
  margin-top: 1px;
  border: 2px solid var(--ink-soft);
  border-radius: 50%;
  background: transparent;
  color: transparent;
  font-size: 11px;
  cursor: pointer;
}

.check-button.checked {
  border-color: var(--teal);
  background: var(--teal);
  color: white;
}

.menu-body {
  min-width: 0;
  flex: 1;
}

.menu-name {
  display: block;
  color: var(--ink);
  font-size: 13px;
  overflow-wrap: anywhere;
}

.menu-note.done .menu-name {
  color: var(--ink-soft);
  text-decoration: line-through;
}

.menu-meta {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 6px;
}

.menu-badge {
  border-radius: 999px;
  padding: 2px 7px;
  background: rgb(63 122 109 / 12%);
  color: var(--teal-dark);
  font-size: 9.5px;
}

.menu-badge.meal-prep {
  background: rgb(255 143 163 / 20%);
  color: var(--pink-dark);
}

.user-magnet {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  box-shadow:
    inset 0 -2px 2px rgb(0 0 0 / 25%),
    0 1px 2px rgb(0 0 0 / 30%);
}

.user-magnet.me {
  background: radial-gradient(
    circle at 35% 30%,
    #f0a488,
    var(--coral)
  );
}

.user-magnet.husband {
  background: radial-gradient(
    circle at 35% 30%,
    #7fb3a5,
    var(--teal)
  );
}

.delete-button {
  flex: none;
  border: 0;
  padding: 2px;
  background: transparent;
  color: var(--ink-soft);
  font-size: 16px;
  cursor: pointer;
  opacity: 0.55;
}

.done-stamp {
  position: absolute;
  top: 5px;
  right: 22px;
  border: 2px solid var(--stamp);
  border-radius: 4px;
  padding: 1px 5px;
  color: var(--stamp);
  font-size: 9px;
  font-weight: 700;
  transform: rotate(-12deg);
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
  flex: 1 1 200px;
}

.add-form input,
.add-form select {
  border: 1px solid #eadfe8;
  border-radius: 8px;
  padding: 10px 11px;
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

.add-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

@media (max-width: 640px) {
  .section-header {
    align-items: flex-start;
  }

  .week-navigation {
    grid-template-columns:
      70px 1fr 70px;
    gap: 5px;
    padding: 8px;
  }

  .week-button {
    padding: 8px 5px;
    font-size: 12px;
  }

  .week-title {
    font-size: 12px;
  }

  .user-toggle {
    width: 100%;
    justify-content: center;
  }

  .add-form {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .add-form input {
    grid-column: 1 / -1;
    width: 100%;
    min-width: 0;
  }

  .add-button {
    grid-column: 1 / -1;
  }
}
</style>