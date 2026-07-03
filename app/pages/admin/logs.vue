<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['admin', 'admin-manage'] })
useHead({ title: 'Admin Logs' })

interface AuditLog {
  id: number
  actorId: number | null
  actorEmail: string
  actorName: string | null
  action: string
  entityType: string
  entityId: string
  entityTitle: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

const { data: logs, pending } = await useFetch<AuditLog[]>('/api/admin/logs')

const actionLabels: Record<string, string> = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
  login: 'Logged in'
}

function actorLabel(log: AuditLog) {
  return log.actorName || log.actorEmail
}

function targetLabel(log: AuditLog) {
  return log.entityTitle || log.entityId
}

function metadataText(log: AuditLog) {
  if (!log.metadata || !Object.keys(log.metadata).length) return ''
  return JSON.stringify(log.metadata, null, 2)
}

function when(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}
</script>

<template>
  <div class="admin-wrap">
    <div class="page-head">
      <div>
        <NuxtLink to="/admin" class="back">Dashboard</NuxtLink>
        <h1>Admin Logs</h1>
        <p class="sub">Audit trail for admin accounts and editorial post changes.</p>
      </div>
    </div>

    <div class="log-table">
      <table v-if="logs?.length" class="tbl">
        <thead>
          <tr>
            <th>Time</th>
            <th>Admin</th>
            <th>Action</th>
            <th>Target</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in logs" :key="log.id">
            <td class="muted">{{ when(log.createdAt) }}</td>
            <td>
              <strong>{{ actorLabel(log) }}</strong>
              <span>{{ log.actorEmail }}</span>
            </td>
            <td><span class="pill" :class="`pill--${log.action}`">{{ actionLabels[log.action] || log.action }}</span></td>
            <td>
              <strong>{{ targetLabel(log) }}</strong>
              <span>{{ log.entityType }} · {{ log.entityId }}</span>
            </td>
            <td>
              <details v-if="metadataText(log)" class="details">
                <summary>View</summary>
                <pre>{{ metadataText(log) }}</pre>
              </details>
              <span v-else class="muted">None</span>
            </td>
          </tr>
        </tbody>
      </table>

      <p v-else-if="pending" class="empty">Loading logs...</p>
      <p v-else class="empty">No admin actions have been logged yet.</p>
    </div>
  </div>
</template>

<style scoped>
.admin-wrap { max-width: 1120px; margin: 0 auto; padding: 3rem 2rem 5rem; }
.page-head { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 2.5rem; gap: 1.5rem; }
.page-head h1 { font-family: var(--font-serif); font-size: 2.5rem; font-weight: 200; margin-top: 0.5rem; }
.back { display: inline-block; font-size: 0.58rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); text-decoration: none; }
.back:hover { color: var(--accent); }
.sub { font-size: 0.78rem; line-height: 1.7; color: var(--muted); margin-top: 0.35rem; }
.log-table { border-top: 1px solid var(--subtle); overflow-x: auto; }
.tbl { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
.tbl th { text-align: left; font-size: 0.5rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--muted); font-weight: 500; padding: 0.85rem 0.75rem; border-bottom: 1px solid var(--subtle); }
.tbl td { padding: 0.95rem 0.75rem; border-bottom: 1px solid var(--subtle); vertical-align: top; min-width: 140px; }
.tbl td strong { display: block; font-weight: 500; color: var(--dark); margin-bottom: 0.2rem; }
.tbl td span { display: block; color: var(--muted); font-size: 0.68rem; }
.muted { color: var(--muted); }
.pill { display: inline-block; border: 1px solid var(--subtle); padding: 0.24rem 0.5rem; color: var(--muted); font-size: 0.56rem; letter-spacing: 0.12em; text-transform: uppercase; }
.pill--create { color: var(--accent); }
.pill--update { color: #6b7fd4; }
.pill--delete { color: #b0243c; }
.pill--login { color: #24745b; }
.details summary { cursor: pointer; color: var(--dark); font-size: 0.62rem; letter-spacing: 0.14em; text-transform: uppercase; }
.details summary:hover { color: var(--accent); }
.details pre { margin-top: 0.75rem; max-width: 360px; max-height: 180px; overflow: auto; background: var(--paper); border: 1px solid var(--subtle); padding: 0.75rem; color: var(--dark); font-size: 0.72rem; line-height: 1.5; white-space: pre-wrap; }
.empty { color: var(--muted); font-size: 0.9rem; padding: 2rem 0; }
@media (max-width: 720px) {
  .admin-wrap { padding: 2rem 1rem 4rem; }
}
</style>
