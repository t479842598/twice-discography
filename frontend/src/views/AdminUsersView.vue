<template>
  <section class="admin-module admin-users-module">
    <header class="admin-module-header">
      <div>
        <span class="admin-module-kicker">{{ t('admin.common.eyebrow') }}</span>
        <h1>{{ t('admin.users.title') }}</h1>
        <p>{{ t('admin.users.description') }}</p>
      </div>
      <div class="admin-module-metrics">
        <span><strong>{{ users.length }}</strong>{{ t('admin.users.tab.users') }}</span>
        <span><strong>{{ roles.length }}</strong>{{ t('admin.users.tab.roles') }}</span>
      </div>
    </header>

    <section class="admin-segmented-control" role="tablist" :aria-label="t('admin.users.title')">
      <button type="button" role="tab" :aria-selected="activePanel === 'users'" :class="{ 'is-active': activePanel === 'users' }" @click="activePanel = 'users'">
        <n-icon :component="PeopleOutline" />
        <span>{{ t('admin.users.tab.users') }}</span>
      </button>
      <button type="button" role="tab" :aria-selected="activePanel === 'roles'" :class="{ 'is-active': activePanel === 'roles' }" @click="activePanel = 'roles'">
        <n-icon :component="ShieldCheckmarkOutline" />
        <span>{{ t('admin.users.tab.roles') }}</span>
      </button>
    </section>

    <section v-if="activePanel === 'users'" class="admin-panel">
      <div class="admin-section-title">
        <div>
          <h2>{{ t('admin.users.usersTitle') }}</h2>
          <p>{{ t('admin.users.usersDescription') }}</p>
        </div>
        <n-button type="primary" @click="openCreateUser">
          <template #icon>
            <n-icon :component="PersonAddOutline" />
          </template>
          {{ t('admin.users.createAdmin') }}
        </n-button>
      </div>

      <div class="admin-table">
        <div class="admin-table-row admin-table-head admin-user-table-row">
          <span>{{ t('admin.users.column.account') }}</span>
          <span>{{ t('admin.users.column.displayName') }}</span>
          <span>{{ t('admin.users.column.roles') }}</span>
          <span>{{ t('admin.common.actions') }}</span>
        </div>
        <div v-for="user in users" :key="user.id" class="admin-table-row admin-user-table-row">
          <span class="admin-table-cell admin-account-cell" :data-label="t('admin.users.column.account')">{{ user.email }}</span>
          <span class="admin-table-cell" :data-label="t('admin.users.column.displayName')">{{ user.displayName }}</span>
          <div class="admin-table-cell admin-role-badges" :data-label="t('admin.users.column.roles')">
            <span v-for="role in user.roles" :key="role" class="admin-role-chip">{{ roleLabel(role) }}</span>
          </div>
          <div class="admin-table-cell admin-inline-actions" :data-label="t('admin.common.actions')">
            <n-button size="small" type="primary" secondary @click="openEditUser(user)">
              <template #icon>
                <n-icon :component="CreateOutline" />
              </template>
              {{ t('admin.common.edit') }}
            </n-button>
          </div>
        </div>
      </div>
    </section>

    <section v-if="activePanel === 'roles'" class="admin-panel">
      <div class="admin-section-title">
        <div>
          <h2>{{ t('admin.users.rolesTitle') }}</h2>
          <p>{{ t('admin.users.rolesDescription') }}</p>
        </div>
        <n-button type="primary" secondary @click="showRoleForm = !showRoleForm">
          <template #icon>
            <n-icon :component="showRoleForm ? ChevronUpOutline : AddOutline" />
          </template>
          {{ showRoleForm ? t('admin.users.collapseAdd') : t('admin.users.addRole') }}
        </n-button>
      </div>

      <div v-if="showRoleForm" class="admin-role-form">
        <n-input v-model:value="newRole.id" :placeholder="t('admin.users.roleIdPlaceholder')" />
        <n-input v-model:value="newRole.label" :placeholder="t('admin.users.roleLabelPlaceholder')" />
        <n-button type="primary" @click="createRole">{{ t('admin.users.confirmAddRole') }}</n-button>
      </div>

      <div class="admin-table">
        <div class="admin-table-row admin-table-head admin-role-table-row">
          <span>{{ t('admin.users.column.roleId') }}</span>
          <span>{{ t('admin.users.column.roleName') }}</span>
          <span>{{ t('admin.users.column.type') }}</span>
          <span>{{ t('admin.common.actions') }}</span>
        </div>
        <div v-for="role in roles" :key="role.id" class="admin-table-row admin-role-table-row">
          <span class="admin-table-cell admin-role-id" :data-label="t('admin.users.column.roleId')">{{ role.id }}</span>
          <div class="admin-table-cell" :data-label="t('admin.users.column.roleName')">
            <span v-if="role.system" class="admin-role-chip">{{ roleLabel(role.id) }}</span>
            <n-input v-else v-model:value="role.label" size="small" />
          </div>
          <span class="admin-table-cell" :data-label="t('admin.users.column.type')">{{ role.system ? t('admin.users.systemRole') : t('admin.users.customRole') }}</span>
          <div class="admin-table-cell admin-inline-actions" :data-label="t('admin.common.actions')">
            <n-button size="small" type="primary" text @click="saveRole(role)">{{ t('admin.common.saveChanges') }}</n-button>
            <n-button size="small" type="error" text :disabled="role.system" @click="deleteRole(role)">{{ t('admin.common.delete') }}</n-button>
          </div>
        </div>
      </div>
    </section>

    <p v-if="message" class="admin-message admin-page-message">{{ message }}</p>

    <n-modal v-model:show="showUserModal" preset="card" class="admin-user-modal" :title="isEditingUser ? t('admin.users.editAdmin') : t('admin.users.newAdmin')">
      <n-form class="admin-dialog-form" label-placement="top" @submit.prevent="submitUserModal">
        <n-form-item :label="t('admin.users.column.account')">
          <n-input v-model:value="userForm.email" :disabled="isEditingUser" :placeholder="t('admin.users.emailPlaceholder')" />
        </n-form-item>
        <n-form-item :label="t('admin.users.column.displayName')">
          <n-input v-model:value="userForm.displayName" :placeholder="t('admin.users.displayNamePlaceholder')" />
        </n-form-item>
        <n-form-item :label="isEditingUser ? t('admin.users.changePassword') : t('admin.users.initialPassword')">
          <n-input
            v-model:value="userForm.password"
            type="password"
            show-password-on="click"
            :placeholder="isEditingUser ? t('admin.users.passwordKeepPlaceholder') : t('admin.users.passwordMinPlaceholder')"
          />
        </n-form-item>
        <n-form-item :label="t('admin.users.column.roles')">
          <n-select v-model:value="userForm.roles" multiple :options="roleOptions" :placeholder="t('admin.users.rolePlaceholder')" />
        </n-form-item>
        <div class="admin-dialog-actions">
          <n-button @click="showUserModal = false">{{ t('admin.common.cancel') }}</n-button>
          <n-button type="primary" attr-type="submit" :loading="userSaving">{{ isEditingUser ? t('admin.common.saveChanges') : t('admin.users.confirmCreate') }}</n-button>
        </div>
        <p v-if="userFormError" class="admin-error">{{ userFormError }}</p>
      </n-form>
    </n-modal>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  AddOutline,
  ChevronUpOutline,
  CreateOutline,
  PeopleOutline,
  PersonAddOutline,
  ShieldCheckmarkOutline,
} from '@vicons/ionicons5'
import { api } from '@/api/client'
import type { AdminRole, AdminUser } from '@/api/types'
import { useI18n } from '@/i18n'
import type { MessageKey } from '@/i18n/messages'

const { t } = useI18n()
const activePanel = ref<'users' | 'roles'>('users')
const users = ref<AdminUser[]>([])
const roles = ref<AdminRole[]>([])
const message = ref('')
const showRoleForm = ref(false)
const systemRoleLabelKeys: Record<string, MessageKey> = {
  owner: 'admin.users.role.owner',
  admin: 'admin.users.role.admin',
  editor: 'admin.users.role.editor',
}
const roleOptions = computed(() => roles.value.map((role) => ({ label: roleLabel(role.id), value: role.id })))
const newRole = reactive({ id: '', label: '' })
const showUserModal = ref(false)
const userSaving = ref(false)
const userFormError = ref('')
const editingUser = ref<AdminUser | null>(null)
const isEditingUser = computed(() => Boolean(editingUser.value))
const userForm = reactive({
  id: '',
  email: '',
  displayName: '',
  password: '',
  roles: ['editor'] as string[],
})

async function loadUsers() {
  users.value = (await api.adminUsers()).users
}

async function loadRoles() {
  roles.value = (await api.adminRoles()).roles
}

async function refreshAll() {
  await Promise.all([loadUsers(), loadRoles()])
}

function roleLabel(roleId: string) {
  const systemKey = systemRoleLabelKeys[roleId]
  if (systemKey) return t(systemKey)
  return roles.value.find((role) => role.id === roleId)?.label || roleId
}

function resetUserForm() {
  userForm.id = ''
  userForm.email = ''
  userForm.displayName = ''
  userForm.password = ''
  userForm.roles = ['editor']
}

function openCreateUser() {
  editingUser.value = null
  resetUserForm()
  message.value = ''
  userFormError.value = ''
  showUserModal.value = true
}

function openEditUser(user: AdminUser) {
  editingUser.value = user
  userForm.id = user.id
  userForm.email = user.email
  userForm.displayName = user.displayName
  userForm.password = ''
  userForm.roles = [...user.roles]
  message.value = ''
  userFormError.value = ''
  showUserModal.value = true
}

function validateUserForm() {
  if (!userForm.email.trim()) return t('admin.users.validation.account')
  if (!userForm.displayName.trim()) return t('admin.users.validation.displayName')
  if (!userForm.roles.length) return t('admin.users.validation.roles')
  if (!isEditingUser.value && userForm.password.length < 8) return t('admin.users.validation.initialPassword')
  if (isEditingUser.value && userForm.password && userForm.password.length < 8) return t('admin.users.validation.newPassword')
  return ''
}

async function submitUserModal() {
  const validationError = validateUserForm()
  if (validationError) {
    userFormError.value = validationError
    return
  }

  userSaving.value = true
  message.value = ''
  userFormError.value = ''
  try {
    if (isEditingUser.value) {
      const payload: { displayName: string; roles: string[]; password?: string } = {
        displayName: userForm.displayName.trim(),
        roles: [...userForm.roles],
      }
      if (userForm.password) payload.password = userForm.password
      const saved = await api.adminUpdateUser(userForm.id, payload)
      const target = users.value.find((user) => user.id === saved.user.id)
      if (target) Object.assign(target, saved.user)
      message.value = t('admin.users.savedAdmin', { name: saved.user.displayName })
    } else {
      await api.adminCreateUser({
        email: userForm.email.trim(),
        displayName: userForm.displayName.trim(),
        password: userForm.password,
        roles: [...userForm.roles],
      })
      message.value = t('admin.users.adminCreated')
      await loadUsers()
    }
    showUserModal.value = false
  } catch {
    userFormError.value = t('admin.common.saveFailed')
  } finally {
    userSaving.value = false
  }
}

async function createRole() {
  message.value = ''
  const id = newRole.id.trim()
  const label = newRole.label.trim()
  if (!id) {
    message.value = t('admin.users.validation.roleId')
    return
  }
  if (!label) {
    message.value = t('admin.users.validation.roleName')
    return
  }

  try {
    await api.adminCreateRole({ id, label })
    newRole.id = ''
    newRole.label = ''
    showRoleForm.value = false
    message.value = t('admin.users.roleAdded')
    await loadRoles()
  } catch {
    message.value = t('admin.common.saveFailed')
  }
}

async function saveRole(role: AdminRole) {
  if (!role.label.trim()) {
    message.value = t('admin.users.validation.roleName')
    return
  }

  try {
    const saved = await api.adminUpdateRole(role.id, { label: role.label.trim() })
    Object.assign(role, saved.role)
    message.value = t('admin.users.roleSaved', { label: role.label })
  } catch {
    message.value = t('admin.common.saveFailed')
  }
}

async function deleteRole(role: AdminRole) {
  if (role.system) return
  try {
    await api.adminDeleteRole(role.id)
    message.value = t('admin.users.roleDeleted', { label: role.label })
    await refreshAll()
  } catch {
    message.value = t('admin.common.saveFailed')
  }
}

onMounted(refreshAll)
</script>
