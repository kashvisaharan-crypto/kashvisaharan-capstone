# Meal Billing Agent — Biometric & Photo-Based Mess Billing System

A hostel mess billing system that charges students for what they actually
eat, not a flat monthly fee. Students log in with their college Google
account, upload a photo of their meal tray, and an AI agent verifies their
attendance, cross-checks the photo against the real weekly menu, and
calculates an itemized bill — flagging anything uncertain for human review
instead of guessing.

## How it works

1. **Login** — student signs in with their `@flame.edu.in` Google account.
   No manual name/ID entry; the student's unique email is their identity
   throughout the app, which also means two students who happen to share a
   name are never confused with each other.
2. **Upload** — student picks a date and meal slot, uploads a photo of their
   tray.
3. **Agent loop (perceive → reason → act → observe)**:
   - **Perceive**: reads the photo, the date/meal, and the student's
     identity from their session.
   - **Reason**: checks the biometric attendance record for that exact
     meal slot (a hard gate — no record means no bill, regardless of the
     photo). If present, sends the photo to Gemini Vision to identify the
     food, then cross-references it against that day's real published
     menu.
   - **Act**: if attendance is confirmed and the food matches the menu,
     calculates an itemized cost.
   - **Observe**: if anything is uncertain — no attendance record, low
     confidence, or food that doesn't match the menu — the meal is flagged
     for human review instead of silently billed.
4. **Raise an Issue** — a student can dispute any result. This sends a real
   email (via the Gmail API, as the student themselves) to the hostel
   office, plus a confirmation email back to the student.
5. **Quarterly Bill** — shows the current quarter's total by default, with
   a dropdown to view any past quarter with recorded meals.

## Architecture

- **Skill** (`skill.md`) — the single, scoped task definition: reconcile a
  meal photo against biometric attendance and the weekly menu into one
  verified billing line item. Loaded by the agent at runtime via MCP (not
  just implemented in code) and injected directly into the prompt sent to
  Gemini.
- **MCP connector** — the agent connects to the official
  `@modelcontextprotocol/server-filesystem` as a real MCP client (verified
  with a live handshake) to read `menu.json`, `biometric.json`, and
  `skill.md`, and to write bill records — not plain Node.js file I/O.
- **Google OAuth** — real "Sign in with Google," restricted to
  `@flame.edu.in` accounts, also used to authorize sending email as the
  student via the Gmail API (no separate admin credentials needed).

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- A Google Cloud project with OAuth 2.0 credentials (Client ID + Secret)
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

## Setup

1. **Clone the repo:**
   ```bash
   git clone git@github.com:kashvisaharan-crypto/kashvisaharan-capstone.git
   cd kashvisaharan-capstone/meal-billing-agent
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up Google OAuth credentials:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   - Create an OAuth 2.0 Client ID (type: Web application)
   - Under "Authorized redirect URIs," add:
     `http://localhost:3000/auth/google/callback`
   - Copy the generated Client ID and Client Secret

4. **Create a `.env` file** in `meal-billing-agent/` with the following
   (each on its own line — a merged/combined line will break the app):
   ```
   GEMINI_API_KEY=your_gemini_api_key
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
   SESSION_SECRET=any_random_long_string
   PORT=3000
   ```

5. **Run it:**
   ```bash
   node index.js
   ```
   You should see confirmation that the MCP filesystem connector and
   Google OAuth are both active, then:
   ```
   Meal Billing Agent running at http://localhost:3000
   ```

6. Open `http://localhost:3000` in your browser and sign in.

## Sample data

`biometric.json` includes 100 sample students (with a few intentional
duplicate names, to demonstrate that email — not name — is the real unique
identifier) and `menu.json` contains a real transcribed week of hostel
menu data. To test with your own account, add an entry to `biometric.json`
keyed by your own `@flame.edu.in` email.

## Known limitations (honest, by design)

- Gmail OAuth access tokens expire after roughly an hour; if a student's
  session has been open a long time, sending the Raise-an-Issue email may
  fail. This is handled gracefully (a clear message asks them to log out
  and back in) rather than silently failing.
- The weekly menu and biometric attendance data are currently manual/sample
  data, not a live feed from real hardware or a real menu-upload system —
  a natural next step beyond this MVP.

## Tech stack

Node.js, Express, Passport (Google OAuth 2.0), Google Gemini Vision API,
Gmail API, Model Context Protocol (filesystem server), vanilla JS/HTML/CSS
frontend.
