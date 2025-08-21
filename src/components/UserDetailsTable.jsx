import dayjs from 'dayjs'
import RoleBadge from './RoleBadge.jsx'

export default function UserDetailsTable({ user }) {
  if (!user) return null
  return (
    <div className="card p-4">
      <div className="mb-3 text-lg font-semibold">User Details</div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Name" value={user.name} />
        <Field label="Email" value={user.email || '-'} />
        <Field label="Employee ID" value={user.empId || '-'} />
        <Field label="Role" value={<RoleBadge role={user.role} />} />
        <Field label="Status" value={user.status} />
        <Field label="Designation" value={user.designation?.name || '-'} />
        <Field label="Department" value={user.department?.name || '-'} />
        <Field label="Division" value={user.division?.name || '-'} />
        <Field label="Date of Joining" value={user.dateOfJoining ? dayjs(user.dateOfJoining).format('YYYY-MM-DD') : '-'} />
        <Field label="Reports To" value={(user.reportingTo || []).map(r => r.name || r.empId).join(', ') || '-'} />
      </div>
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="text-sm">{value || '-'}</div>
    </div>
  )
}
