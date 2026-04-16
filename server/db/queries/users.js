import db from '#db/client.js'
import bcrypt from 'bcrypt'

// Creates a new user with a bcrypt-hashed password.
// Returns the new user object, or null if the username is already taken.
export async function createUser({ username, password }) {
    const hashedPassword = await bcrypt.hash(password, 15)

    // WHY (Functionality): DO NOTHING on conflict means we will not accidentally overwrite
    // an existing user's password if someone registers with a username that's already taken.
    // The previous version used DO UPDATE, which was a serious security bug — it would
    // silently replace another user's password with the attacker's new hash, effectively
    // locking out the real account owner. Now we return null instead, and the route
    // sends a proper 409 Conflict response.
    const { rows } = await db.query(`
        INSERT INTO users (username, password)
        VALUES ($1, $2)
        ON CONFLICT (username) DO NOTHING
        RETURNING *
    `, [username, hashedPassword])

    return rows[0] || null
}


export async function getUserById(id){
    const {rows} = await db.query(
        `SELECT id, username FROM users WHERE id = $1`,[id]
    )

    return rows[0]
}