import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

export default function Homepage() {
  const { token } = useAuth()
  const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'

  const [form, setForm] = useState({
    title: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    suffix: '',
    phone_number: '',
    email_address: '',
    street: '',
    apt: '',
    city: '',
    us_state: '',
    zip_code: '',
    dob: '',
  })

  const [message, setMessage] = useState('')

  useEffect(() => {
    async function loadPii() {
      if (!token) return
      try {
        const response = await fetch(API + '/pii/getPii', {
          headers: {
            Authorization: 'Bearer ' + token,
          },
        })
        if (!response.ok) return
        const data = await response.json()

        setForm({
          title: data.title || '',
          first_name: data.first_name || '',
          middle_name: data.middle_name || '',
          last_name: data.last_name || '',
          suffix: data.suffix || '',
          phone_number: data.phone_number || '',
          email_address: data.email_address || '',
          street: data.street || '',
          apt: data.apt || '',
          city: data.city || '',
          us_state: data.us_state || '',
          zip_code: data.zip_code || '',
          dob: data.dob ? String(data.dob).slice(0, 10) : '',
        })
      } catch (err) {
        console.log('Could not load PII')
      }
    }

    loadPii()
  }, [token, API])

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage('')

    try {
      const response = await fetch(API + '/pii/createPii', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify(form),
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(errText)
      }

      await response.json()
      setMessage('Saved')
    } catch (err) {
      setMessage(err.message)
    }
  }

  if (!token) {
    return <p className="login-message">Login to access main feature.</p>
  }

  return (
    <div className="homepage-wrapper">
      <div className="homepage-card">
        <h1 className="homepage-title">Enter Your Information</h1>
        <p className="homepage-subtitle">
          We&apos;ll use this to find and remove your data from broker databases.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <label className="form-label">Title</label>
            <input
              className="form-input"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="Mr / Ms / Dr"
            />
          </div>

          <div className="form-section">
            <label className="form-label">First Name</label>
            <input
              className="form-input"
              name="first_name"
              value={form.first_name}
              onChange={handleChange}
              placeholder="John"
            />
          </div>

          <div className="form-section">
            <label className="form-label">Middle Name</label>
            <input
              className="form-input"
              name="middle_name"
              value={form.middle_name}
              onChange={handleChange}
              placeholder="Michael"
            />
          </div>

          <div className="form-section">
            <label className="form-label">Last Name</label>
            <input
              className="form-input"
              name="last_name"
              value={form.last_name}
              onChange={handleChange}
              placeholder="Doe"
            />
          </div>

          <div className="form-section">
            <label className="form-label">Suffix</label>
            <input
              className="form-input"
              name="suffix"
              value={form.suffix}
              onChange={handleChange}
              placeholder="Jr / Sr / III"
            />
          </div>

          <div className="form-section">
            <label className="form-label">Email Address</label>
            <input
              className="form-input"
              name="email_address"
              value={form.email_address}
              onChange={handleChange}
              placeholder="your@email.com"
            />
            <a href="#" className="add-link">+ Add Another Email</a>
          </div>

          <div className="form-section">
            <label className="form-label">Phone Number</label>
            <input
              className="form-input"
              name="phone_number"
              value={form.phone_number}
              onChange={handleChange}
              placeholder="(555) 123-4567"
            />
            <a href="#" className="add-link">+ Add Another Phone</a>
          </div>

          <div className="form-section">
            <label className="form-label">Street</label>
            <input
              className="form-input"
              name="street"
              value={form.street}
              onChange={handleChange}
              placeholder="123 Main St"
            />
          </div>

          <div className="form-section">
            <label className="form-label">Apt / Unit</label>
            <input
              className="form-input"
              name="apt"
              value={form.apt}
              onChange={handleChange}
              placeholder="Apt 4B"
            />
          </div>

          <div className="form-section">
            <label className="form-label">City</label>
            <input
              className="form-input"
              name="city"
              value={form.city}
              onChange={handleChange}
              placeholder="New York"
            />
          </div>

          <div className="form-section">
            <label className="form-label">State</label>
            <input
              className="form-input"
              name="us_state"
              value={form.us_state}
              onChange={handleChange}
              placeholder="NY"
            />
          </div>

          <div className="form-section">
            <label className="form-label">ZIP Code</label>
            <input
              className="form-input"
              name="zip_code"
              value={form.zip_code}
              onChange={handleChange}
              placeholder="10001"
            />
            <a href="#" className="add-link">+ Add Another Address</a>
          </div>

          <div className="form-section">
            <label className="form-label">Date of Birth</label>
            <input
              className="form-input"
              type="date"
              name="dob"
              value={form.dob}
              onChange={handleChange}
            />
          </div>

          <button className="submit-button" type="submit">
            Save & Continue
          </button>
        </form>

        {message ? <p className="status-message">{message}</p> : null}
      </div>
    </div>
  )
}