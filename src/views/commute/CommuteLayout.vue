<template>
  <section class="commute-layout">
    <nav class="commute-navigation">
      <RouterLink to="/commute/beluga"> 벨루 </RouterLink>

      <RouterLink to="/commute/oppa"> 오빠 </RouterLink>
    </nav>

    <RouterView />
  </section>
</template>

<style scoped>
.commute-layout {
  width: 100%;
}

.commute-navigation {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  max-width: 500px;
  margin: 0 auto 24px;
}

.commute-navigation a {
  padding: 12px;
  border: 1px solid rgb(255 255 255 / 72%);
  border-radius: 14px;
  background: rgb(255 255 255 / 58%);
  color: #6d6173;
  font-size: 14px;
  font-weight: 700;
  text-align: center;
  text-decoration: none;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.commute-navigation a:hover {
  background: rgb(255 255 255 / 85%);
}

.commute-navigation a.router-link-active {
  background: #e8d7f3;
  color: #503363;
}
</style>
