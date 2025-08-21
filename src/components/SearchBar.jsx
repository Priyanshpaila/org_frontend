export default function SearchBar({ value, onChange, onSubmit }) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit?.() }} className="flex items-center gap-2">
      <input className="input" placeholder="Search by name, empId, or email..." value={value} onChange={e => onChange(e.target.value)} />
      <button className="btn btn-primary" type="submit">Search</button>
    </form>
  )
}
