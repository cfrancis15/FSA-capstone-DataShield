import "dotenv/config";
import { Stagehand } from "@browserbasehq/stagehand";
import db from "./db/client.js";
import { getAllPii } from "./db/queries/pii.js";

const FORM_URL =
  "https://privacyportal.onetrust.com/webform/342ca6ac-4177-4827-b61e-19070296cbd3/7229a09c-578f-4ac6-a987-e0428a7b877e";

function dobUs(dob) {
  const s = String(dob);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : s;
}

async function sendDeleteEmail(p, broker) {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  const from = process.env.MAILGUN_FROM;

  if (!apiKey || !domain || !from) {
    console.error("Missing Mailgun env vars");
    return;
  }

  if (!broker.email) {
    console.error("Missing broker email for broker", broker.id);
    return;
  }

  const subject = "Data Deletion Request";
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

  const auth = "Basic " + Buffer.from("api:" + apiKey).toString("base64");

  const response = await fetch("https://api.mailgun.net/v3/" + domain + "/messages", {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error("Mailgun send failed: " + response.status + " " + body);
  }
}

const t = 120_000;

await db.connect();

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

const users = await getAllPii();

const brokerResult = await db.query(
  `SELECT id, firm_name, email FROM brokers ORDER BY id`
);
const brokers = brokerResult.rows;

for (const p of users) {
  const stagehand = new Stagehand({
    env: "BROWSERBASE",
    apiKey: process.env.BROWSERBASE_API_KEY,
    projectId: process.env.BROWSERBASE_PROJECT_ID,
  });

  try {
    await stagehand.init();
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

    for (const broker of brokers) {
      try {
        await sendDeleteEmail(p, broker);

        await db.query(
          `INSERT INTO deletion_requests (user_id, broker_id) VALUES ($1, $2)`,
          [p.user_id, broker.id]
        );

        console.log("email sent for user", p.user_id, "to broker", broker.firm_name);
      } catch (emailErr) {
        console.error(
          "email failed for user",
          p.user_id,
          "to broker",
          broker.firm_name,
          emailErr
        );
      }
    }

    console.log("submitted for user", p.user_id);
  } catch (err) {
    console.error("user_id", p.user_id, err);
  } finally {
    await stagehand.close?.();
  }
}

await db.end();
console.log("done");