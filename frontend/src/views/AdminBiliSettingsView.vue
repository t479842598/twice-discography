<template>
  <section class="admin-module admin-bili-module">
    <header class="admin-module-header">
      <div>
        <span class="admin-module-kicker">{{ t('admin.common.eyebrow') }}</span>
        <h1>{{ t('admin.bili.title') }}</h1>
        <p>{{ t('admin.bili.description') }}</p>
      </div>
      <div class="admin-status-pill" :class="{ 'is-ok': status?.configured }">
        <n-icon :component="status?.configured ? ShieldCheckmarkOutline : AlertCircleOutline" />
        <span>{{ status?.configured ? t('admin.bili.configured') : t('admin.bili.notConfigured') }}</span>
      </div>
    </header>

    <section class="admin-split-grid">
      <div class="admin-panel admin-credential-editor">
        <div class="admin-section-title">
          <div>
            <h2>{{ t('admin.bili.save') }}</h2>
            <p>{{ t('admin.bili.warning') }}</p>
          </div>
          <n-icon class="admin-section-icon" :component="KeyOutline" />
        </div>

        <n-input
          v-model:value="cookie"
          class="admin-cookie-input"
          type="textarea"
          :autosize="{ minRows: 7, maxRows: 12 }"
          placeholder="SESSDATA=...; bili_jct=...; DedeUserID=..."
        />

        <div class="admin-actions-row">
          <n-button type="primary" :disabled="!cookie.trim()" @click="saveCookie">
            <template #icon>
              <n-icon :component="SaveOutline" />
            </template>
            {{ t('admin.bili.save') }}
          </n-button>
          <n-button secondary @click="verifyCookie">
            <template #icon>
              <n-icon :component="RefreshOutline" />
            </template>
            {{ t('admin.bili.verify') }}
          </n-button>
        </div>
        <p v-if="message" class="admin-message">{{ message }}</p>
      </div>

      <aside class="admin-panel admin-credential-status">
        <span class="admin-health-label">{{ t('admin.dashboard.workbench.status.title') }}</span>
        <strong>{{ t('admin.bili.configStatus', { status: status?.configured ? t('admin.bili.configured') : t('admin.bili.notConfigured') }) }}</strong>
        <div class="admin-status-list">
          <div>
            <span>{{ t('admin.bili.verifyStatus', { status: translatedVerifyStatus }) }}</span>
          </div>
          <div v-if="translatedLastVerifyMessage">
            <span>{{ translatedLastVerifyMessage }}</span>
          </div>
        </div>
      </aside>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { AlertCircleOutline, KeyOutline, RefreshOutline, SaveOutline, ShieldCheckmarkOutline } from '@vicons/ionicons5'
import { ApiError, api } from '@/api/client'
import { useI18n } from '@/i18n'
import type { MessageKey } from '@/i18n/messages'

const { t } = useI18n()
const cookie = ref('')
const message = ref('')
const status = ref<{ configured: boolean; lastVerifiedAt: number | null; lastVerifyStatus: string | null; lastVerifyMessage: string | null } | null>(null)
const biliMessageKeys: Record<string, MessageKey> = {
  ok: 'admin.bili.status.ok',
  failed: 'admin.bili.status.failed',
  'B站凭证未配置': 'admin.bili.status.notConfigured',
  'B站登录态不可用': 'admin.bili.status.loginUnavailable',
  bili_credential_not_configured: 'admin.bili.status.notConfigured',
  bili_login_unavailable: 'admin.bili.status.loginUnavailable',
  missing_cookie: 'admin.bili.needCookie',
  missing_bili_credential_encryption_key: 'admin.bili.error.missingKey',
  '服务端缺少 BILI_CREDENTIAL_ENCRYPTION_KEY 配置': 'admin.bili.error.missingKey',
}

const translatedVerifyStatus = computed(() => {
  if (!status.value?.lastVerifyStatus) return t('admin.bili.notVerified')
  return t(biliMessageKeys[status.value.lastVerifyStatus] || 'admin.bili.status.failed')
})

const translatedLastVerifyMessage = computed(() => localizeBiliMessage(status.value?.lastVerifyMessage))

async function loadStatus() {
  status.value = await api.adminBiliCredential()
}

async function saveCookie() {
  const trimmedCookie = cookie.value.trim()
  if (!trimmedCookie) {
    message.value = t('admin.bili.needCookie')
    return
  }

  try {
    await api.adminSaveBiliCredential(trimmedCookie)
    cookie.value = ''
    message.value = t('admin.bili.saved')
    await loadStatus()
  } catch (error) {
    message.value = error instanceof ApiError ? t('admin.bili.saveFailed', { message: localizeBiliMessage(error.message) }) : t('admin.common.saveRetry')
  }
}

async function verifyCookie() {
  try {
    const result = await api.adminVerifyBiliCredential()
    message.value = localizeBiliMessage(result.message)
    await loadStatus()
  } catch (error) {
    message.value = error instanceof ApiError ? t('admin.bili.verifyFailed', { message: localizeBiliMessage(error.message) }) : t('admin.bili.verifyRetry')
  }
}

function localizeBiliMessage(value: string | null | undefined) {
  if (!value) return ''
  const key = biliMessageKeys[value]
  if (key) return t(key)

  const loggedIn = value.match(/^已登录：(.+)，VIP 状态：(.+)$/)
  if (loggedIn) {
    const vipStatus = loggedIn[2].includes('可用') ? t('admin.bili.status.vipAvailable') : t('admin.bili.status.vipUnknown')
    return t('admin.bili.status.loggedIn', { name: loggedIn[1], status: vipStatus })
  }

  return value
}

onMounted(loadStatus)
</script>
