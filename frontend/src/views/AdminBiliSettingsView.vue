<template>
  <main class="page admin-page">
    <section class="page-header">
      <div>
        <span class="eyebrow">Admin</span>
        <h1>B站凭证</h1>
        <p>Cookie 只会加密保存到服务端，不会下发到前端或 Worker。</p>
      </div>
      <RouterLink class="section-toggle" to="/admin">返回后台</RouterLink>
    </section>
    <section class="panel admin-panel">
      <n-alert type="warning" :bordered="false">保存前请确认该账号已获得用于本站播放 MV 的授权。建议只粘贴必要 Cookie，并定期更新。</n-alert>
      <n-input v-model:value="cookie" type="textarea" :autosize="{ minRows: 5, maxRows: 9 }" placeholder="SESSDATA=...; bili_jct=...; DedeUserID=..." />
      <div class="admin-actions-row">
        <n-button type="primary" @click="saveCookie">保存凭证</n-button>
        <n-button secondary @click="verifyCookie">验证凭证</n-button>
      </div>
      <div class="admin-credential-status">
        <strong>配置状态：{{ status?.configured ? '已配置' : '未配置' }}</strong>
        <span>验证状态：{{ status?.lastVerifyStatus || '未验证' }}</span>
        <span v-if="status?.lastVerifyMessage">{{ status.lastVerifyMessage }}</span>
      </div>
      <p v-if="message" class="admin-message">{{ message }}</p>
    </section>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { api } from '@/api/client'

const cookie = ref('')
const message = ref('')
const status = ref<{ configured: boolean; lastVerifiedAt: number | null; lastVerifyStatus: string | null; lastVerifyMessage: string | null } | null>(null)

async function loadStatus() {
  status.value = await api.adminBiliCredential()
}

async function saveCookie() {
  await api.adminSaveBiliCredential(cookie.value)
  cookie.value = ''
  message.value = '凭证已加密保存'
  await loadStatus()
}

async function verifyCookie() {
  const result = await api.adminVerifyBiliCredential()
  message.value = result.message
  await loadStatus()
}

onMounted(loadStatus)
</script>
