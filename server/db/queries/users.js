import db from '#db/client.js'
import bcrypt from 'bcrypt'

//creating user with hashed password
export async function createUser({username,password}){
    const hashedPassword = await bcrypt.hash(password,10)

    const {rows} = await db.query(`
        INSERT INTO users (username, password)
        VALUES ($1,$2) ON CONFLICT (username)
        DO UPDATE SET password = EXCLUDED.password RETURNING *
        `,[username, hashedPassword])

        return rows[0]
}


export async function getUserById(id){
    const {rows} = await db.query(
        `SELECT id, username FROM users WHERE id = $1`,[id]
    )

    return rows[0]
}