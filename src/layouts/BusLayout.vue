<template>
  <section>
    <header>
      <h2>버스</h2>
      <p>출근과 퇴근버스를 관리합니다.</p>
    </header>

    <nav class="sub-navigation">
      <RouterLink to="/bus/commute"> 출근버스 </RouterLink>

      <RouterLink to="/bus/return"> 퇴근버스 </RouterLink>
    </nav>

    <RouterView />
  </section>
</template>

<style scoped>
.sub-navigation {
  display: flex;
  gap: 8px;
  margin: 20px 0;
}

.sub-navigation a {
  flex: 1;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 14px;
  color: #555;
  text-align: center;
  text-decoration: none;
}

.sub-navigation a.router-link-active {
  background: #eadcf5;
  color: #553567;
  font-weight: 700;
}
</style>
