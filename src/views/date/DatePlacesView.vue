<script setup>
import { computed, onMounted, ref } from 'vue'

import { supabase } from '@/lib/supabase'

const placeName = ref('')
const category = ref('맛집')
const memo = ref('')

const places = ref([])

const loading = ref(false)
const adding = ref(false)
const message = ref('')

const remainingCount = computed(() => {
  return places.value.filter((place) => !place.visited).length
})

async function loadPlaces() {
  loading.value = true
  message.value = ''

  const { data, error } = await supabase.from('date_places').select('*').order('created_at', {
    ascending: false,
  })

  if (error) {
    console.error(error)

    message.value = '가고 싶은 곳을 불러오지 못했어요.'

    loading.value = false

    return
  }

  places.value = data ?? []

  loading.value = false
}

async function addPlace() {
  const trimmedPlaceName = placeName.value.trim()

  const trimmedMemo = memo.value.trim()

  if (!trimmedPlaceName || adding.value) {
    return
  }

  adding.value = true
  message.value = ''

  const { data, error } = await supabase
    .from('date_places')
    .insert({
      place_name: trimmedPlaceName,
      category: category.value,
      memo: trimmedMemo || null,
      visited: false,
    })
    .select()
    .single()

  if (error) {
    console.error(error)

    message.value = '장소를 추가하지 못했어요.'

    adding.value = false

    return
  }

  places.value.unshift(data)

  placeName.value = ''
  category.value = '맛집'
  memo.value = ''

  adding.value = false
}

async function toggleVisited(place) {
  const nextVisited = !place.visited

  const { data, error } = await supabase
    .from('date_places')
    .update({
      visited: nextVisited,
    })
    .eq('id', place.id)
    .select()
    .single()

  if (error) {
    console.error(error)

    message.value = '방문 상태를 저장하지 못했어요.'

    return
  }

  const index = places.value.findIndex((currentPlace) => currentPlace.id === place.id)

  if (index !== -1) {
    places.value[index] = data
  }
}

async function removePlace(id) {
  const confirmed = window.confirm('이 장소를 삭제할까요?')

  if (!confirmed) {
    return
  }

  const { error } = await supabase.from('date_places').delete().eq('id', id)

  if (error) {
    console.error(error)

    message.value = '장소를 삭제하지 못했어요.'

    return
  }

  places.value = places.value.filter((place) => place.id !== id)
}

onMounted(() => {
  loadPlaces()
})
</script>

<template>
  <section class="places-view">
    <header class="section-header">
      <div>
        <h2>가고 싶은 곳</h2>

        <p>같이 가보고 싶은 장소를 저장해두는 공간이에요.</p>
      </div>

      <span class="count"> {{ remainingCount }}곳 남음 </span>
    </header>

    <form class="add-form" @submit.prevent="addPlace">
      <input v-model="placeName" type="text" maxlength="60" placeholder="예: 성수동 카페" />

      <select v-model="category">
        <option value="맛집">맛집</option>

        <option value="카페">카페</option>

        <option value="전시">전시</option>

        <option value="여행">여행</option>

        <option value="공원">공원</option>

        <option value="영화">영화</option>

        <option value="기타">기타</option>
      </select>

      <input v-model="memo" type="text" maxlength="100" placeholder="메모 (선택)" />

      <button type="submit" :disabled="!placeName.trim() || adding">
        {{ adding ? '추가 중...' : '추가' }}
      </button>
    </form>

    <p v-if="message" class="message">
      {{ message }}
    </p>

    <div v-if="loading" class="empty-state">불러오는 중...</div>

    <div v-else-if="places.length" class="place-list">
      <article
        v-for="place in places"
        :key="place.id"
        class="place-card"
        :class="{
          visited: place.visited,
        }"
      >
        <div class="card-top">
          <span class="category-badge">
            {{ place.category }}
          </span>

          <button
            type="button"
            class="delete-button"
            aria-label="삭제"
            @click="removePlace(place.id)"
          >
            ×
          </button>
        </div>

        <h3>
          {{ place.place_name }}
        </h3>

        <p v-if="place.memo" class="memo">
          {{ place.memo }}
        </p>

        <button
          type="button"
          class="visit-button"
          :class="{
            complete: place.visited,
          }"
          @click="toggleVisited(place)"
        >
          {{ place.visited ? '다녀왔어요 ✓' : '아직 안 갔어요' }}
        </button>
      </article>
    </div>

    <div v-else class="empty-state">아직 저장한 장소가 없어요.</div>
  </section>
</template>

<style scoped>
.places-view {
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

  grid-template-columns: 2fr 1fr 2fr auto;

  gap: 8px;

  margin-bottom: 18px;
  padding: 12px;

  border: 1px solid var(--line);
  border-radius: 16px;

  background: white;
}

.add-form input,
.add-form select {
  min-width: 0;

  padding: 11px 12px;

  border: 1px solid var(--line);
  border-radius: 11px;

  background: white;

  color: var(--text);

  font-size: 13px;

  outline: none;
}

.add-form input:focus,
.add-form select:focus {
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
  color: #b45c75;

  font-size: 13px;
  text-align: center;
}

.place-list {
  display: grid;

  grid-template-columns: repeat(2, minmax(0, 1fr));

  gap: 12px;
}

.place-card {
  padding: 15px;

  border: 1px solid var(--line);
  border-radius: 17px;

  background: white;

  box-shadow: 0 5px 16px rgb(73 57 87 / 7%);
}

.place-card.visited {
  opacity: 0.65;
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.category-badge {
  padding: 4px 8px;

  border-radius: 999px;

  background: #f2e9f7;

  color: #6b527b;

  font-size: 11px;
  font-weight: 700;
}

.place-card h3 {
  margin: 12px 0 5px;

  color: var(--title);

  font-size: 16px;
}

.memo {
  margin: 0 0 12px;

  color: var(--muted);

  font-size: 12px;
  line-height: 1.5;
}

.visit-button {
  width: 100%;

  margin-top: 10px;
  padding: 9px;

  border: 1px solid var(--pink-strong);
  border-radius: 11px;

  background: white;

  color: var(--pink-strong);

  font-size: 12px;
  font-weight: 700;

  cursor: pointer;
}

.visit-button.complete {
  background: var(--pink-strong);

  color: white;
}

.delete-button {
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

  color: var(--muted);

  font-size: 14px;
  text-align: center;
}

@media (max-width: 640px) {
  .section-header {
    align-items: flex-start;
  }

  .add-form {
    grid-template-columns: 1fr;
  }

  .place-list {
    grid-template-columns: 1fr;
  }

  .add-form button {
    width: 100%;
  }
}
</style>
