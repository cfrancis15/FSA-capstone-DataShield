import express from 'express'
import { createPii, getPiiById } from '#db/queries/pii.js'
import getUserFromToken from '../middleware/getUserFromToken.js'
import requireUser from '../middleware/requireUser.js'


//Make a route to add and pull from PII

const router = express.Router()

router.post('/createPii', getUserFromToken, requireUser, async (req, res) => {
    const userId = req.user.id
    const {
      title,
      first_name,
      middle_name,
      last_name,
      suffix,
      phone_number,
      email_address,
      street,
      apt,
      city,
      us_state,
      zip_code,
      dob,
    } = req.body
    if (
      !first_name ||
      !last_name ||
      !phone_number ||
      !email_address ||
      !street ||
      !city ||
      !us_state ||
      !zip_code ||
      !dob
    ) {
      return res.status(400).send('Missing required fields')
    }
    try {
      const newPii = await createPii({
        user_id: userId,
        title,
        first_name,
        middle_name,
        last_name,
        suffix,
        phone_number,
        email_address,
        street,
        apt,
        city,
        us_state,
        zip_code,
        dob,
      })
      res.status(201).json(newPii)
    } catch (err) {
      console.error(err)
      res.status(500).send('Could not save PII')
    }
  })

  router.get('/getPii', getUserFromToken, requireUser, async (req, res) => {
    const userId = req.user.id
    try {
      const pii = await getPiiById(userId)
      if (!pii) {
        return res.status(404).send('No PII found')
      }
      res.status(200).json(pii)
    } catch (err) {
      console.error(err)
      res.status(500).send('Could not get PII')
    }
  })

  router.get('/acxiomSubmissions', getUserFromToken, requireUser, async (req, res) => {
    try {
      const { rows } = await db.query(
        `SELECT id, submitted_at FROM acxiom_opt_out_submissions WHERE user_id = $1 ORDER BY submitted_at DESC`,
        [req.user.id]
      )
      res.json(rows)
    } catch (err) {
      console.error(err)
      res.status(500).send('Could not load submissions')
    }
  })






export default router