import "dotenv/config";
import { Stagehand } from "@browserbasehq/stagehand";
import db from "./db/client.js";
import { getAllPii } from "./db/queries/pii.js";

// Third-party webform used for Acxiom delete requests.
const FORM_URL =
  "https://privacyportal.onetrust.com/webform/342ca6ac-4177-4827-b61e-19070296cbd3/7229a09c-578f-4ac6-a987-e0428a7b877e";

// Convert DB date format to the MM/DD/YYYY format expected by the form.
function dobUs(dob) {
  const s = String(dob);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : s;
}

async function sendDeleteEmail(p, broker) {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  const from = process.env.MAILGUN_FROM;

  console.log("[mailgun] env check", {
    hasApiKey: Boolean(apiKey),
    hasDomain: Boolean(domain),
    hasFrom: Boolean(from),
  });

  if (!apiKey || !domain || !from) {
    throw new Error("Missing Mailgun env vars");
  }

  if (!broker || !broker.email) {
    throw new Error("Missing broker email");
  }

  if (!p || !p.email_address) {
    throw new Error("Missing user email_address");
  }

  const subject = "Data Deletion Request";
  // Simple plain-text email that includes user PII for broker lookup/deletion.
  const text =
    "Hello " +
    broker.firm_name +
    ",\n\n" +
    "Please delete all data associated with this person:\n\n" +
    "Name: " +
    p.first_name +
    " " +
    p.last_name +
    "\n" +
    "Email: " +
    p.email_address +
    "\n" +
    "Phone: " +
    p.phone_number +
    "\n" +
    "DOB: " +
    p.dob +
    "\n" +
    "Address: " +
    p.street +
    (p.apt ? " " + p.apt : "") +
    ", " +
    p.city +
    ", " +
    p.us_state +
    " " +
    p.zip_code +
    "\n\n" +
    "Thank you.";

  const form = new URLSearchParams();
  form.append("from", from);
  form.append("to", broker.email);
  form.append("subject", subject);
  form.append("text", text);

  const url = "https://api.mailgun.net/v3/" + domain + "/messages";
  const auth = "Basic " + Buffer.from("api:" + apiKey).toString("base64");

  console.log("[mailgun] sending", {
    user_id: p.user_id,
    broker_id: broker.id,
    broker_email: broker.email,
    url,
    from,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  const bodyText = await response.text();

  console.log("[mailgun] response", {
    ok: response.ok,
    status: response.status,
    body: bodyText,
    user_id: p.user_id,
    broker_id: broker.id,
  });

  if (!response.ok) {
    throw new Error("Mailgun send failed: " + response.status + " " + bodyText);
  }
}

const t = 120_000;

await db.connect();
console.log("[job] connected to db");

// Ensure tracking table exists for Acxiom submissions.
await db.query(`
  CREATE TABLE IF NOT EXISTS acxiom_opt_out_submissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`);

await db.query(`
  CREATE TABLE IF NOT EXISTS deletion_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    broker_id INTEGER REFERENCES brokers(id),
    sent_at TIMESTAMP NOT NULL DEFAULT NOW()
  );
`);

console.log("[job] ensured tables exist");

// Load all user PII records that should be processed this run.
const users = await getAllPii();
console.log("[job] users count:", users.length);

const brokerResult = await db.query(
  `SELECT id, firm_name, email FROM brokers ORDER BY id`
);
const brokers = brokerResult.rows;
console.log("[job] brokers count:", brokers.length);

for (const p of users) {
  console.log("[job] start user", p.user_id);
  let stagehand = null;

  // Acxiom flow: attempt webform submission for this user.
  // If Browserbase fails, the email flow below still runs.
  try {
    console.log("[acxiom] init stagehand for user", p.user_id);

    stagehand = new Stagehand({
      env: "BROWSERBASE",
      apiKey: process.env.BROWSERBASE_API_KEY,
      projectId: process.env.BROWSERBASE_PROJECT_ID,
    });

    await stagehand.init();
    console.log("[acxiom] stagehand ready for user", p.user_id);

    const page = stagehand.context.pages()[0];

    await page.goto(FORM_URL, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });

    const d = dobUs(p.dob);

    await stagehand.act('click "as Myself" under I am submitting this request', { timeout: t });
    await stagehand.act('click "Delete" under Select the Right You Want to Exercise', { timeout: t });
    await stagehand.act(`type ${p.email_address} in the Email field`, { timeout: t });
    await stagehand.act(`type ${p.first_name} in the First Name field`, { timeout: t });
    await stagehand.act(`type ${p.last_name} in the Last Name field`, { timeout: t });
    await stagehand.act(`clear the Date of Birth field`, { timeout: t });
    await stagehand.act(`type ${d} in the Date of Birth field in MM/DD/YYYY format`, { timeout: t });
    await stagehand.act(`type ${p.street} in the Street Address field`, { timeout: t });

    if (p.apt) {
      await stagehand.act(`type ${p.apt} in the Apartment or Address Line 2 field`, { timeout: t });
    }

    await stagehand.act(`type ${p.city} in the City field`, { timeout: t });
    await stagehand.act("click the State dropdown", { timeout: t });
    await stagehand.act(`select ${p.us_state} from the State dropdown list`, { timeout: t });
    await stagehand.act(`type ${p.zip_code} in the ZIP Code field`, { timeout: t });
    await stagehand.act("scroll to the bottom of the form", { timeout: t });
    await stagehand.act('click the "I am not a robot" checkbox', { timeout: t });
    await stagehand.act("click the main submit button", { timeout: t });

    await db.query(
      `INSERT INTO acxiom_opt_out_submissions (user_id) VALUES ($1)`,
      [p.user_id]
    );

    console.log("[acxiom] submitted and logged for user", p.user_id);
  } catch (err) {
    console.error("[acxiom] failed for user", p.user_id, err);
  } finally {
    if (stagehand) {
      await stagehand.close?.();
      console.log("[acxiom] stagehand closed for user", p.user_id);
    }
  }

  // Email flow: send deletion emails to all brokers for this user.
  console.log("[email] starting broker loop for user", p.user_id);

  for (const broker of brokers) {
    try {
      console.log("[email] attempt", {
        user_id: p.user_id,
        broker_id: broker.id,
        broker_name: broker.firm_name,
        broker_email: broker.email,
      });

      await sendDeleteEmail(p, broker);

      await db.query(
        `INSERT INTO deletion_requests (user_id, broker_id) VALUES ($1, $2)`,
        [p.user_id, broker.id]
      );

      console.log("[email] sent and logged", {
        user_id: p.user_id,
        broker_id: broker.id,
      });
    } catch (emailErr) {
      console.error("[email] failed", {
        user_id: p.user_id,
        broker_id: broker.id,
        broker_name: broker.firm_name,
        broker_email: broker.email,
        error: String(emailErr),
      });
    }
  }

  console.log("[job] finished user", p.user_id);
}

await db.end();
console.log("[job] done");