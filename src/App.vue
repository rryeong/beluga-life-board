<template>
  <div class="app">
    <header class="app-header">
      <RouterLink to="/" class="title-link">
        <h1>🐳 벨루가네 </h1>
      </RouterLink>

      <nav class="main-navigation">
        <RouterLink to="/meal">밥</RouterLink>
        <RouterLink to="/bus">버스</RouterLink>
        <RouterLink to="/tennis">테니스</RouterLink>
      </nav>
    </header>

    <main class="app-content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  background: #f8f4fb;
}

.app-header {
  padding: 20px;
  border-bottom: 1px solid #e9dfef;
  background: white;
}

.title-link {
  color: inherit;
  text-decoration: none;
}

h1 {
  margin: 0 0 18px;
  color: #493957;
  font-size: 24px;
  text-align: center;
}

.main-navigation {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  max-width: 700px;
  margin: 0 auto;
}

.main-navigation a {
  padding: 12px;
  border-radius: 14px;
  color: #6d6173;
  text-align: center;
  text-decoration: none;
}

.main-navigation a.router-link-active {
  background: #e8d7f3;
  color: #503363;
  font-weight: 700;
}

.app-content {
  width: min(100% - 24px, 900px);
  margin: 0 auto;
  padding: 28px 0 60px;
}
</style>