<template>
  <section class="date-layout">
    <nav class="date-navigation">
      <RouterLink to="/date/wishlist" class="date-tab"> 하고 싶은 것 </RouterLink>

      <RouterLink to="/date/places" class="date-tab"> 가고 싶은 곳 </RouterLink>

      <RouterLink to="/date/schedule" class="date-tab"> 데이트 일정 </RouterLink>

      <RouterLink to="/date/memories" class="date-tab"> 추억 </RouterLink>
    </nav>

    <RouterView />
  </section>
</template>

<style scoped>
.date-layout {
  width: 100%;
}

.date-navigation {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;

  margin-bottom: 20px;
  padding: 6px;

  border-radius: 16px;
  background: #f3ebf7;
}

.date-tab {
  display: flex;
  align-items: center;
  justify-content: center;

  min-height: 42px;

  padding: 9px 10px;

  border-radius: 12px;

  color: #6d6173;

  font-size: 13px;
  font-weight: 700;

  text-align: center;
  text-decoration: none;
}

.date-tab:hover {
  background: #eee2f5;
}

.date-tab.router-link-active {
  background: white;
  color: #503363;

  box-shadow: 0 3px 10px rgb(73 57 87 / 10%);
}

@media (max-width: 640px) {
  .date-navigation {
    grid-template-columns: repeat(2, 1fr);
    margin-bottom: 16px;
  }

  .date-tab {
    min-height: 40px;
    padding: 9px 6px;
    font-size: 12px;
  }
}
</style>
