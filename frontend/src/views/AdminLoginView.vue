<template>
  <main class="page admin-page admin-login-page">
    <section class="admin-login-shell">
      <div class="admin-login-copy">
        <div class="admin-login-brand-row">
          <span class="admin-console-mark">TW</span>
          <span class="admin-login-brand-name">
            <strong>{{ t('admin.dashboard.kicker') }}</strong>
            <span>{{ t('admin.common.eyebrow') }} · {{ t('admin.dashboard.tab.overview') }}</span>
          </span>
        </div>
        <span class="admin-hero-live">{{ t('admin.dashboard.workbench.live') }}</span>
        <span class="admin-module-kicker">{{ t('admin.login.stageTitle') }}</span>
        <h1 class="admin-login-stage-title">{{ t('admin.login.stageTitle') }}</h1>
        <p>{{ t('admin.login.tagline') }}</p>
        <span class="admin-login-eq" aria-hidden="true">
          <span class="admin-login-eq-bar"></span>
          <span class="admin-login-eq-bar"></span>
          <span class="admin-login-eq-bar"></span>
          <span class="admin-login-eq-bar"></span>
          <span class="admin-login-eq-bar"></span>
        </span>
      </div>

      <section class="admin-panel admin-login-panel">
        <div class="admin-login-panel-head">
          <div>
            <h2>{{ t('admin.login.title') }}</h2>
            <p>{{ t('admin.dashboard.workbench.status.access') }}</p>
          </div>
          <span class="admin-login-status-led">{{ t('admin.dashboard.workbench.status.ready') }}</span>
        </div>
        <n-form class="admin-dialog-form" @submit.prevent="submitLogin">
          <n-form-item :label="t('admin.login.account')">
            <n-input v-model:value="email" :placeholder="t('admin.login.accountPlaceholder')">
              <template #prefix>
                <n-icon :component="PersonOutline" />
              </template>
            </n-input>
          </n-form-item>
          <n-form-item :label="t('admin.login.password')">
            <n-input v-model:value="password" type="password" show-password-on="click" :placeholder="t('admin.login.passwordPlaceholder')">
              <template #prefix>
                <n-icon :component="KeyOutline" />
              </template>
            </n-input>
          </n-form-item>
          <n-button type="primary" attr-type="submit" :loading="loading" block>
            <template #icon>
              <n-icon :component="LogInOutline" />
            </template>
            {{ t('admin.login.submit') }}
          </n-button>
          <p v-if="error" class="admin-error">{{ error }}</p>
        </n-form>
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { KeyOutline, LogInOutline, PersonOutline } from '@vicons/ionicons5'
import { api } from '@/api/client'
import { useI18n } from '@/i18n'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
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
  } catch {
    error.value = t('admin.login.failed')
  } finally {
    loading.value = false
  }
}

async function checkExistingLogin() {
  try {
    const session = await api.adminSession()
    if (session.user) {
      await router.replace(typeof route.query.redirect === 'string' ? route.query.redirect : '/admin')
    }
  } catch {
    // Not logged in yet.
  }
}

onMounted(checkExistingLogin)
</script>
