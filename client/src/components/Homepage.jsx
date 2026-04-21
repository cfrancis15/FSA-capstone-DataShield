import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import SuccessfulAcxiomRequests from './SuccessfulAcxiomRequests.jsx'

export default function Homepage() {







  const { token } = useAuth()
  const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'


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
    return <p>Login to access main feature.</p>
  }

  return (
    <div>
      <p>PII form</p>
      <form onSubmit={handleSubmit}>
        <input name="title" value={form.title} onChange={handleChange} placeholder="title" />
        <input name="first_name" value={form.first_name} onChange={handleChange} placeholder="first_name" />
        <input name="middle_name" value={form.middle_name} onChange={handleChange} placeholder="middle_name" />
        <input name="last_name" value={form.last_name} onChange={handleChange} placeholder="last_name" />
        <input name="suffix" value={form.suffix} onChange={handleChange} placeholder="suffix" />
        <input name="phone_number" value={form.phone_number} onChange={handleChange} placeholder="phone_number" />
        <input name="email_address" value={form.email_address} onChange={handleChange} placeholder="email_address" />
        <input name="street" value={form.street} onChange={handleChange} placeholder="street" />
        <input name="apt" value={form.apt} onChange={handleChange} placeholder="apt" />
        <input name="city" value={form.city} onChange={handleChange} placeholder="city" />
        <input name="us_state" value={form.us_state} onChange={handleChange} placeholder="us_state" />
        <input name="zip_code" value={form.zip_code} onChange={handleChange} placeholder="zip_code" />
        <input name="dob" value={form.dob} onChange={handleChange} placeholder="dob" />
        <button type="submit">Submit</button>
      </form>
      {message ? <p>{message}</p> : null}

      <br/>

      <SuccessfulAcxiomRequests/>
    </div>
  )
}