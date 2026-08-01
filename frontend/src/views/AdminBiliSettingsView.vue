<template>
  <section class="admin-module admin-bili-module">
    <header class="admin-module-header">
      <div>
        <span class="admin-module-kicker">{{ t('admin.common.eyebrow') }}</span>
        <h1>{{ t('admin.bili.title') }}</h1>
        <p>{{ t('admin.bili.description') }}</p>
      </div>
      <div class="admin-status-pill" :class="{ 'is-ok': status?.usable }">
        <n-icon :component="status?.usable ? ShieldCheckmarkOutline : AlertCircleOutline" />
        <span>{{ status?.usable ? t('admin.bili.configured') : t('admin.bili.notConfigured') }}</span>
      </div>
    </header>

    <section v-if="statusLoading" class="admin-bili-statusbar" aria-hidden="true">
      <div v-for="n in 3" :key="'sb' + n" class="admin-bili-status-item">
        <span class="admin-skel-block admin-skel-icon"></span>
        <div>
          <span class="admin-skel-line admin-skel-line-xs"></span>
          <span class="admin-skel-line admin-skel-line-md"></span>
        </div>
      </div>
    </section>

    <section v-else class="admin-bili-statusbar">
      <div class="admin-bili-status-item">
        <span class="admin-bili-status-icon" :class="{ 'is-ok': status?.usable }">
          <n-icon :component="status?.usable ? ShieldCheckmarkOutline : AlertCircleOutline" />
        </span>
        <div>
          <small>{{ t('admin.dashboard.workbench.status.title') }}</small>
          <strong>{{ credentialStatusLabel }}</strong>
        </div>
      </div>
      <div class="admin-bili-status-item">
        <span class="admin-bili-status-icon" :class="{ 'is-ok': status?.lastVerifyStatus === 'ok' }">
          <n-icon :component="status?.lastVerifyStatus === 'ok' ? CheckmarkCircleOutline : AlertCircleOutline" />
        </span>
        <div>
          <small>{{ t('admin.bili.verifyStatus', { status: '' }) }}</small>
          <strong>{{ translatedVerifyStatus }}</strong>
        </div>
      </div>
      <div class="admin-bili-status-item is-note">
        <div>
          <small>{{ t('admin.bili.description') }}</small>
        </div>
      </div>
    </section>

    <section class="admin-bili-grid">
      <div class="admin-panel admin-credential-editor">
        <div class="admin-section-title">
          <div>
            <h2>{{ t('admin.bili.save') }}</h2>
            <p>{{ t('admin.bili.warning') }}</p>
          </div>
          <n-icon class="admin-section-icon" :component="KeyOutline" />
        </div>

        <div class="admin-bili-bookmarklet">
          <p class="admin-bili-bookmarklet-hint">{{ t('admin.bili.cliHint') }}</p>
          <div class="admin-bili-bookmarklet-row">
            <code class="admin-bili-cli-cmd">pnpm run grab-bili-cookie</code>
            <n-button size="small" type="primary" @click="copyCliCmd">
              <template #icon><n-icon :component="CopyOutline" /></template>
              {{ t('admin.bili.copyCmd') }}
            </n-button>
          </div>
          <p class="admin-bili-bookmarklet-desc">
            <n-icon :component="InformationCircleOutline" />
            {{ t('admin.bili.cliDesc') }}
          </p>
        </div>

        <n-alert type="warning" :show-icon="true" class="admin-cookie-hint">
          <template #default>{{ t('admin.bili.error.missingSessdata') }}</template>
        </n-alert>

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

      <aside v-if="statusLoading" class="admin-panel admin-credential-status" aria-hidden="true">
        <span class="admin-skel-line admin-skel-line-sm"></span>
        <span class="admin-skel-line admin-skel-line-lg"></span>
        <div class="admin-status-list">
          <div v-for="n in 2" :key="'c' + n">
            <span class="admin-skel-line admin-skel-line-md"></span>
          </div>
        </div>
      </aside>

      <aside v-else class="admin-panel admin-credential-status">
        <span class="admin-health-label">{{ t('admin.bili.verifyStatus', { status: '' }) }}</span>
        <strong>{{ credentialStatusLabel }}</strong>
        <div class="admin-status-list">
          <div v-if="translatedCredentialProblem">
            <span>{{ translatedCredentialProblem }}</span>
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
import { AlertCircleOutline, CheckmarkCircleOutline, CopyOutline, InformationCircleOutline, KeyOutline, RefreshOutline, SaveOutline, ShieldCheckmarkOutline } from '@vicons/ionicons5'
import { ApiError, api } from '@/api/client'
import { useI18n } from '@/i18n'
import type { MessageKey } from '@/i18n/messages'

const { t } = useI18n()
const cookie = ref('')
const message = ref('')
const status = ref<{ configured: boolean; usable: boolean; encryptionVersion: string | null; problem: string | null; lastVerifiedAt: number | null; lastVerifyStatus: string | null; lastVerifyMessage: string | null } | null>(null)
const statusLoading = ref(true)

const credentialStatusLabel = computed(() => t('admin.bili.configStatus', {
  status: status.value?.usable ? t('admin.bili.configured') : t('admin.bili.notConfigured'),
}))
const translatedCredentialProblem = computed(() => localizeBiliMessage(status.value?.problem))

const biliMessageKeys: Record<string, MessageKey> = {
  ok: 'admin.bili.status.ok',
  failed: 'admin.bili.status.failed',
  'B站凭证未配置': 'admin.bili.status.notConfigured',
  'B站登录态不可用': 'admin.bili.status.loginUnavailable',
  bili_credential_not_configured: 'admin.bili.status.notConfigured',
  bili_login_unavailable: 'admin.bili.status.loginUnavailable',
  missing_cookie: 'admin.bili.needCookie',
  missing_bili_credential_encryption_key: 'admin.bili.error.missingKey',
  invalid_bili_credential_encryption_key: 'admin.bili.error.missingKey',
  legacy_bili_credential: 'admin.bili.error.decryptFailed',
  bili_credential_key_mismatch: 'admin.bili.error.decryptFailed',
  bili_credential_decryption_failed: 'admin.bili.error.decryptFailed',
  incomplete_bili_cookie: 'admin.bili.needCookie',
  invalid_bili_cookie: 'admin.bili.needCookie',
  '服务端缺少 BILI_CREDENTIAL_ENCRYPTION_KEY 配置': 'admin.bili.error.missingKey',
}

const translatedVerifyStatus = computed(() => {
  if (!status.value?.lastVerifyStatus) return t('admin.bili.notVerified')
  return t(biliMessageKeys[status.value.lastVerifyStatus] || 'admin.bili.status.failed')
})

const translatedLastVerifyMessage = computed(() => localizeBiliMessage(status.value?.lastVerifyMessage))

async function loadStatus() {
  statusLoading.value = true
  try {
    status.value = await api.adminBiliCredential()
  } finally {
    statusLoading.value = false
  }
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
  if (value.startsWith('incomplete_bili_cookie:')) return t('admin.bili.error.missingSessdata')
  const key = biliMessageKeys[value]
  if (key) return t(key)

  const loggedIn = value.match(/^已登录：(.+)，VIP 状态：(.+)$/)
  if (loggedIn) {
    const vipStatus = loggedIn[2].includes('可用') ? t('admin.bili.status.vipAvailable') : t('admin.bili.status.vipUnknown')
    return t('admin.bili.status.loggedIn', { name: loggedIn[1], status: vipStatus })
  }

  return value
}

async function copyCliCmd() {
  try {
    await navigator.clipboard.writeText('pnpm run grab-bili-cookie')
    message.value = t('admin.bili.cmdCopied')
    setTimeout(() => { message.value = '' }, 3000)
  } catch {
    message.value = t('admin.common.saveRetry')
  }
}

onMounted(loadStatus)
</script>
