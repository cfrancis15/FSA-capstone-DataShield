import express from "express";
import { createUser } from "#db/queries/users.js";
import db from "#db/client.js";
import bcrypt from "bcrypt";
// WHY (Code Style): Using the shared createToken utility instead of calling jwt.sign directly.
// This keeps token creation consistent across routes and ensures the 7-day expiration
// set in utils/jwt.js is always applied. Without it, tokens would never expire.
import { createToken } from "#utils/jwt.js";

const router = express.Router();

router.post("/register", async (req, res) => {
  const { username, password } = req.body;

  // WHY (Functionality): Always validate required fields before hitting the database.
  // A clear 400 status helps the frontend show a useful error message to the user.
  if (!username || !password) {
    return res.status(400).send("Username and password are required");
  }

  try {
    const createdUser = await createUser({ username, password });

    // WHY (Functionality): createUser now returns null when the username is already taken
    // (see db/queries/users.js). A 409 Conflict is more accurate than a generic error —
    // it tells the frontend exactly what went wrong so it can prompt the user to try
    // a different username.
    if (!createdUser) {
      return res.status(409).send("Username already taken");
    }

    const token = createToken({
      id: createdUser.id,
      username: createdUser.username,
    });
    res.status(201).send(token);
  } catch (err) {
    console.error("[REGISTER] error:", err.message);
    res.status(500).send("Registration failed");
  }
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  // WHY (Functionality): Missing fields are a client mistake, not an auth failure.
  // 400 (Bad Request) is more accurate than 401 (Unauthorized) for this case.
  if (!username || !password) {
    return res.status(400).send("Username and password are required");
  }

  try {
    // WHY (Functionality): We select the password column here specifically so bcrypt
    // can verify it below. We avoid selecting extra sensitive columns beyond what's needed.
    const { rows: users } = await db.query(
      "SELECT id, username, password FROM users WHERE username = $1",
      [username],
    );

    // WHY (Functionality): Returning the same vague message whether the username doesn't
    // exist OR the password is wrong. This prevents attackers from learning which
    // usernames are registered on the platform (user enumeration attack).
    if (!users.length) {
      return res.status(401).send("Credentials incorrect");
    }

    // Compare the submitted password to the stored hashed password
    const passwordMatches = await bcrypt.compare(password, users[0].password);

    if (passwordMatches) {
      // WHY (Code Style): Using createToken so the 7-day expiration in utils/jwt.js
      // is always applied. Tokens should not live forever.
      const token = createToken({
        id: users[0].id,
        username: users[0].username,
      });
      res.status(200).send(token);
    } else {
      return res.status(401).send("Credentials incorrect");
    }
  } catch (err) {
    console.error("[LOGIN] error:", err.message);
    return res.status(500).send("Internal server error");
  }
});

export default router;
