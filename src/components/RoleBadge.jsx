export default function RoleBadge({ role }) {
  const colors = {
    superadmin: 'border-red-300 text-red-700 bg-red-50',
    admin: 'border-amber-300 text-amber-700 bg-amber-50',
    user: 'border-emerald-300 text-emerald-700 bg-emerald-50',
  }
  return <span className={['badge', colors[role] || 'border-gray-300 text-gray-700'].join(' ')}>{role}</span>
}
