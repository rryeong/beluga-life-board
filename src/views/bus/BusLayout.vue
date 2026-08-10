<template>
  <section class="bus-layout">
    <nav class="bus-navigation">
      <RouterLink to="/bus/commute" class="bus-tab"> 출근버스 </RouterLink>

      <RouterLink to="/bus/return" class="bus-tab"> 퇴근버스 </RouterLink>
    </nav>

    <RouterView />
  </section>
</template>

<style scoped>
.bus-layout {
  width: 100%;
}

.bus-navigation {
  display: grid;
  grid-template-columns: repeat(2, 1fr);

  gap: 8px;

  margin-bottom: 20px;

  padding: 6px;

  border-radius: 16px;

  background: #f3ebf7;
}

.bus-tab {
  display: block;

  padding: 11px 12px;

  border-radius: 12px;

  color: #6d6173;

  font-size: 14px;
  font-weight: 700;

  text-align: center;
  text-decoration: none;

  transition:
    background 0.2s ease,
    color 0.2s ease,
    box-shadow 0.2s ease;
}

.bus-tab:hover {
  background: #eee2f5;
}

.bus-tab.router-link-active {
  background: white;

  color: #503363;

  box-shadow: 0 3px 10px rgb(73 57 87 / 10%);
}

@media (max-width: 640px) {
  .bus-navigation {
    margin-bottom: 16px;
  }

  .bus-tab {
    padding: 10px 8px;
    font-size: 13px;
  }
}
</style>
