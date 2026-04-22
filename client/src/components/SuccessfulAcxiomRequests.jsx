import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

export default function SuccessfulAcxiomRequests() {
  const { token } = useAuth()
  const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'
  const [rows, setRows] = useState([])
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!token) return
    let cancelled = false
    ;(async () => {
      setErr('')
      try {
        const res = await fetch(API + '/pii/acxiomSubmissions', {
          headers: { Authorization: 'Bearer ' + token },
        })
        if (!res.ok) {
          setErr(await res.text())
          return
        }
        const data = await res.json()
        if (!cancelled) setRows(data)
      } catch (e) {
        if (!cancelled) setErr(e.message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, API])

  if (!token) return null

  return (
    <div>
      <p>Successful Acxiom deletion requests: {rows.length}</p>
      {err ? <p>{err}</p> : null}
      <ul>
        {rows.map((r) => (
          <li key={r.id}>
            {new Date(r.submitted_at).toLocaleString()}
          </li>
        ))}
      </ul>
    </div>
  )
}