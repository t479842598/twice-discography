<template>
  <main class="page admin-page">
    <section class="page-header">
      <div>
        <span class="eyebrow">Admin</span>
        <h1>管理后台</h1>
        <p>管理 MV、B站凭证、用户和角色。</p>
      </div>
    </section>
    <div class="admin-grid">
      <RouterLink class="panel admin-entry" to="/admin/mvs"><strong>MV 管理</strong><span>维护 BVID、封面、首页展示和排序</span></RouterLink>
      <RouterLink class="panel admin-entry" to="/admin/settings/bilibili"><strong>B站凭证</strong><span>保存授权 Cookie 并验证高清能力</span></RouterLink>
      <RouterLink class="panel admin-entry" to="/admin/users"><strong>用户和角色</strong><span>新增管理员、编辑和所有者</span></RouterLink>
    </div>
  </main>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>
