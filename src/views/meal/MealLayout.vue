<template>
  <section class="meal-layout">
    <nav class="meal-navigation">
      <RouterLink to="/meal/weekly-menu"> 이번주 메뉴 </RouterLink>

      <RouterLink to="/meal/fridge"> 냉장고 속 재료 </RouterLink>

      <RouterLink to="/meal/freezer"> 냉동고 속 재료 </RouterLink>

      <RouterLink to="/meal/meal-prep"> 밀프렙 </RouterLink>

      <RouterLink to="/meal/wishlist"> 먹고 싶은 메뉴 </RouterLink>

      <RouterLink to="/meal/shopping"> 장보기 목록 </RouterLink>
    </nav>

    <div class="meal-content">
      <RouterView />
    </div>
  </section>
</template>

<style scoped>
.meal-layout {
  width: 100%;
}

.meal-navigation {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 24px;
}

.meal-navigation a {
  padding: 11px 8px;
  border: 1px solid rgb(255 255 255 / 70%);
  border-radius: 14px;
  background: rgb(255 255 255 / 58%);
  color: #6d6173;
  font-size: 13px;
  font-weight: 600;
  text-align: center;
  text-decoration: none;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  transition:
    transform 0.2s ease,
    background 0.2s ease,
    color 0.2s ease;
}

.meal-navigation a:hover {
  transform: translateY(-1px);
  background: rgb(255 255 255 / 85%);
}

.meal-navigation a.router-link-active {
  background: #e8d7f3;
  color: #503363;
  font-weight: 800;
}

.meal-content {
  width: 100%;
}

@media (max-width: 640px) {
  .meal-navigation {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 7px;
    margin-bottom: 20px;
  }

  .meal-navigation a {
    padding: 10px 6px;
    font-size: 12px;
  }
}
</style>
