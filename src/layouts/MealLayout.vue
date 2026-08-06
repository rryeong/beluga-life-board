<template>
  <section>
    <header>
      <h2>밥</h2>
      <p>식단과 재료를 관리합니다.</p>
    </header>

    <nav class="sub-navigation">
      <RouterLink to="/meal/weekly-menu"> 이번 주 메뉴 </RouterLink>

      <RouterLink to="/meal/fridge"> 냉장고 속 재료 </RouterLink>

      <RouterLink to="/meal/freezer"> 냉동고 속 재료 </RouterLink>

      <RouterLink to="/meal/meal-prep"> 밀프렙 </RouterLink>

      <RouterLink to="/meal/wishlist"> 먹고 싶은 메뉴 </RouterLink>
    </nav>

    <RouterView />
  </section>
</template>

<style scoped>
.sub-navigation {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 20px 0;
}

.sub-navigation a {
  padding: 10px 14px;
  border: 1px solid #ddd;
  border-radius: 20px;
  color: #555;
  text-decoration: none;
}

.sub-navigation a.router-link-active {
  background: #eadcf5;
  color: #553567;
  font-weight: 700;
}
</style>
