<template>
  <main class="page admin-page">
    <section class="page-header">
      <div>
        <span class="eyebrow">Admin</span>
        <h1>用户与角色管理</h1>
        <p>角色名称已中文化；系统权限角色保留为“所有者 / 管理员 / 内容编辑”。</p>
      </div>
      <RouterLink class="section-toggle" to="/admin">返回后台</RouterLink>
    </section>

    <section class="admin-management-tabs">
      <n-button :type="activePanel === 'users' ? 'primary' : 'default'" secondary @click="activePanel = 'users'">用户管理</n-button>
      <n-button :type="activePanel === 'roles' ? 'primary' : 'default'" secondary @click="activePanel = 'roles'">角色管理</n-button>
    </section>

    <section v-if="activePanel === 'users'" class="panel admin-panel">
      <div class="admin-section-title">
        <div>
          <h2>用户管理</h2>
          <p>维护后台账号、显示名、角色和登录密码。</p>
        </div>
        <n-button type="primary" @click="openCreateUser">新增管理员</n-button>
      </div>

      <div class="admin-table">
        <div class="admin-table-row admin-table-head admin-user-table-row">
          <span>账号</span>
          <span>显示名</span>
          <span>角色</span>
          <span>操作</span>
        </div>
        <div v-for="user in users" :key="user.id" class="admin-table-row admin-user-table-row">
          <span>{{ user.email }}</span>
          <span>{{ user.displayName }}</span>
          <div class="admin-role-badges">
            <span v-for="role in user.roles" :key="role" class="admin-role-chip">{{ roleLabel(role) }}</span>
          </div>
          <div class="admin-inline-actions">
            <n-button size="small" type="primary" secondary @click="openEditUser(user)">编辑</n-button>
          </div>
        </div>
      </div>
    </section>

    <section v-if="activePanel === 'roles'" class="panel admin-panel">
      <div class="admin-section-title">
        <div>
          <h2>角色管理</h2>
          <p>角色编号用于系统保存，角色名称显示为中文。系统角色不能删除。</p>
        </div>
      </div>

      <div class="admin-role-toolbar">
        <n-button type="primary" secondary @click="showRoleForm = !showRoleForm">{{ showRoleForm ? '收起添加' : '添加角色' }}</n-button>
      </div>

      <div v-if="showRoleForm" class="admin-role-form admin-card-form">
        <n-input v-model:value="newRole.id" placeholder="角色编号，例如 reviewer" />
        <n-input v-model:value="newRole.label" placeholder="角色名称，例如 内容审核" />
        <n-button type="primary" @click="createRole">确定添加</n-button>
      </div>

      <div class="admin-table">
        <div class="admin-table-row admin-table-head admin-role-table-row">
          <span>角色编号</span>
          <span>角色名称</span>
          <span>类型</span>
          <span>操作</span>
        </div>
        <div v-for="role in roles" :key="role.id" class="admin-table-row admin-role-table-row">
          <span>{{ role.id }}</span>
          <n-input v-model:value="role.label" size="small" />
          <span>{{ role.system ? '系统角色' : '自定义角色' }}</span>
          <div class="admin-inline-actions">
            <n-button size="small" type="primary" text @click="saveRole(role)">修改</n-button>
            <n-button size="small" type="error" text :disabled="role.system" @click="deleteRole(role)">删除</n-button>
          </div>
        </div>
      </div>

    </section>

    <p v-if="message" class="admin-message admin-page-message">{{ message }}</p>

    <n-modal v-model:show="showUserModal" preset="card" class="admin-user-modal" :title="isEditingUser ? '编辑管理员' : '新增管理员'">
      <n-form class="admin-dialog-form" label-placement="top" @submit.prevent="submitUserModal">
        <n-form-item label="账号">
          <n-input v-model:value="userForm.email" :disabled="isEditingUser" placeholder="请输入账号或邮箱" />
        </n-form-item>
        <n-form-item label="显示名">
          <n-input v-model:value="userForm.displayName" placeholder="请输入显示名" />
        </n-form-item>
        <n-form-item :label="isEditingUser ? '修改密码' : '初始密码'">
          <n-input
            v-model:value="userForm.password"
            type="password"
            show-password-on="click"
            :placeholder="isEditingUser ? '留空则不修改密码' : '至少 8 位'"
          />
        </n-form-item>
        <n-form-item label="角色">
          <n-select v-model:value="userForm.roles" multiple :options="roleOptions" placeholder="选择角色" />
        </n-form-item>
        <div class="admin-dialog-actions">
          <n-button @click="showUserModal = false">取消</n-button>
          <n-button type="primary" attr-type="submit" :loading="userSaving">{{ isEditingUser ? '保存修改' : '确定新增' }}</n-button>
        </div>
        <p v-if="userFormError" class="admin-error">{{ userFormError }}</p>
      </n-form>
    </n-modal>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { api } from '@/api/client'
import type { AdminRole, AdminUser } from '@/api/types'

const activePanel = ref<'users' | 'roles'>('users')
const users = ref<AdminUser[]>([])
const roles = ref<AdminRole[]>([])
const message = ref('')
const showRoleForm = ref(false)
const roleOptions = computed(() => roles.value.map((role) => ({ label: role.label, value: role.id })))
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
  if (!userForm.email.trim()) return '请填写账号'
  if (!userForm.displayName.trim()) return '请填写显示名'
  if (!userForm.roles.length) return '请至少选择一个角色'
  if (!isEditingUser.value && userForm.password.length < 8) return '初始密码至少 8 位'
  if (isEditingUser.value && userForm.password && userForm.password.length < 8) return '新密码至少 8 位'
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
      message.value = `已保存管理员：${saved.user.displayName}`
    } else {
      await api.adminCreateUser({
        email: userForm.email.trim(),
        displayName: userForm.displayName.trim(),
        password: userForm.password,
        roles: [...userForm.roles],
      })
      message.value = '管理员已创建'
      await loadUsers()
    }
    showUserModal.value = false
  } catch (error) {
    userFormError.value = error instanceof Error ? error.message : '保存失败'
  } finally {
    userSaving.value = false
  }
}

async function createRole() {
  await api.adminCreateRole({ ...newRole })
  newRole.id = ''
  newRole.label = ''
  showRoleForm.value = false
  message.value = '角色已添加'
  await loadRoles()
}

async function saveRole(role: AdminRole) {
  const saved = await api.adminUpdateRole(role.id, { label: role.label })
  Object.assign(role, saved.role)
  message.value = `已修改角色：${role.label}`
}

async function deleteRole(role: AdminRole) {
  if (role.system) return
  await api.adminDeleteRole(role.id)
  message.value = `已删除角色：${role.label}`
  await refreshAll()
}

onMounted(refreshAll)
</script>
