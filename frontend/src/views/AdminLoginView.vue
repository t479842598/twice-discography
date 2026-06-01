<template>
  <main class="page admin-page admin-login-page">
    <section class="panel admin-login-panel">
      <span class="eyebrow">Admin</span>
      <h1>后台登录</h1>
      <n-form @submit.prevent="submitLogin">
        <n-form-item label="账号">
          <n-input v-model:value="email" placeholder="请输入账号" />
        </n-form-item>
        <n-form-item label="密码">
          <n-input v-model:value="password" type="password" show-password-on="click" placeholder="请输入密码" />
        </n-form-item>
        <n-button type="primary" attr-type="submit" :loading="loading" block>登录</n-button>
        <p v-if="error" class="admin-error">{{ error }}</p>
      </n-form>
    </section>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, ApiError } from '@/api/client'

const router = useRouter()
const route = useRoute()
const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

async function submitLogin() {
  loading.value = true
  error.value = ''
  try {
    await api.adminLogin(email.value, password.value)
    await router.push(typeof route.query.redirect === 'string' ? route.query.redirect : '/admin')
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : '登录失败'
  } finally {
    loading.value = false
  }
}

async function checkExistingLogin() {
  try {
    await api.adminMe()
    await router.replace(typeof route.query.redirect === 'string' ? route.query.redirect : '/admin')
  } catch {
    // Not logged in yet.
  }
}

onMounted(checkExistingLogin)
</script>
