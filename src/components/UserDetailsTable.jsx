import dayjs from 'dayjs'
import RoleBadge from './RoleBadge.jsx'

export default function UserDetailsTable({ user }) {
  if (!user) return null
  return (
    <div className="card overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Card header */}
      <div className="flex items-center gap-3 border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white px-4 py-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600">
          {/* simple monogram circle, no extra logic */}
          <span className="text-sm font-semibold">
            {(user?.name || 'U').slice(0, 1).toUpperCase()}
          </span>
        </div>
        <div className="min-w-0">
          <div className="truncate text-base font-semibold text-slate-900">
            {user.name}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="truncate">{user.email || '—'}</span>
            <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:inline-block" />
            <span className="truncate">ID: {user.empId || '—'}</span>
          </div>
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-1 gap-0 md:grid-cols-2 lg:grid-cols-3">
        <Field label="Name" value={user.name} />
        <Field label="Email" value={user.email || '—'} />
        <Field label="Employee ID" value={user.empId || '—'} />

        <Field label="Role" value={<RoleBadge role={user.role} />} />
        <Field
          label="Status"
          value={<Pill>{user.status || '—'}</Pill>}
        />

        <Field label="Designation" value={user.designation?.name || '—'} />
        <Field label="Department" value={user.department?.name || '—'} />
        <Field label="Division" value={user.division?.name || '—'} />
        <Field
          label="Date of Joining"
          value={
            user.dateOfJoining
              ? dayjs(user.dateOfJoining).format('YYYY-MM-DD')
              : '—'
          }
        />
        <Field
          label="Reports To"
          value={
            (user.reportingTo || [])
              .map((r) => r.name || r.empId)
              .join(', ') || '—'
          }
          className="md:col-span-2 lg:col-span-3"
        />
      </div>
    </div>
  )
}

/* ---------- Presentational bits only (no data logic) ---------- */

function Field({ label, value, className = '' }) {
  return (
    <div
      className={`border-t border-slate-100 px-4 py-3 first:border-0 md:border-l md:first:border-l-0 ${className}`}
    >
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="min-h-[1.5rem] text-sm text-slate-900">{value || '—'}</div>
    </div>
  )
}

function Pill({ children }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200">
      {children}
    </span>
  )
}
