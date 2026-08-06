<script setup>
import belugaPair from '@/assets/beluga-pair.png'
</script>

<template>
  <div class="app">
    <header class="app-header">
      <RouterLink to="/" class="title-link">
        <div class="brand-title">
          <img :src="belugaPair" alt="벨루가 두 마리" class="brand-icon" />

          <h1>벨루가네</h1>
        </div>
      </RouterLink>

      <nav class="main-navigation">
        <RouterLink to="/meal"> 밥 </RouterLink>

        <RouterLink to="/bus"> 버스 </RouterLink>

        <RouterLink to="/commute"> 출퇴근 </RouterLink>

        <RouterLink to="/tennis"> 테니스 </RouterLink>
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
  display: block;
  width: fit-content;
  margin: 0 auto 18px;
  color: inherit;
  text-decoration: none;
}

.brand-title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.brand-icon {
  width: 58px;
  height: 58px;
  flex-shrink: 0;
  object-fit: contain;
}

h1 {
  margin: 0;
  color: #493957;
  font-size: 24px;
  line-height: 1.2;
  text-align: center;
}

.main-navigation {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
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

.main-navigation a:hover {
  background: #f2e9f7;
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

@media (max-width: 640px) {
  .app-header {
    padding: 16px 14px;
  }

  .title-link {
    margin-bottom: 14px;
  }

  .brand-title {
    gap: 8px;
  }

  .brand-icon {
    width: 46px;
    height: 46px;
  }

  h1 {
    font-size: 22px;
  }

  .main-navigation {
    grid-template-columns: repeat(2, 1fr);
  }

  .main-navigation a {
    padding: 10px 8px;
    font-size: 14px;
  }

  .app-content {
    width: min(100% - 20px, 900px);
    padding-top: 22px;
  }
}
</style>
