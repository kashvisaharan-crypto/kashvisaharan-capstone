# Meal Analysis Skill

This skill lets an AI agent inspect a photo of a student's meal tray and decide
whether to bill the student automatically or flag the meal for human review.

## Inputs

| Field | Description |
|---|---|
| `photo` | Image file of the meal tray (multipart upload) |
| `studentId` | Student's full name, used as the identifier everywhere, e.g. `Priya Sharma`. Auto-filled and locked on the upload form from whoever is logged in — not freely chosen. |
| `date` | Date of the meal in `YYYY-MM-DD` format, must fall within `menu.json` |
| `mealSlot` | One of `Breakfast`, `Lunch`, `Evening Snacks`, `Dinner`, or `Brunch` (Sunday only, replaces Breakfast/Lunch) |

The frontend also enforces two client-side rules before a request is ever sent:
the date picker has no minimum (any past date is selectable) but cannot select
a date after today, and the meal slot dropdown only offers slots whose start
time has already passed when today's date is selected (Breakfast 7:00 AM,
Lunch 12:00 PM, Evening Snacks 4:00 PM, Dinner 7:00 PM; Brunch uses the
Breakfast threshold). Any past date always shows all of that day's slots. If a
not-yet-started slot is submitted anyway, the UI blocks it with "This meal
slot has not started yet." instead of calling the API.

## Login

There's no real auth system — `/login` asks the student to pick their name
from a dropdown and type their Student ID; `POST /api/login` checks the ID
against `biometric.json` and, on a match, stores the logged-in name in a
single server-side in-memory variable (no cookies, no sessions). This is
intentionally simple for a single-user demo and does not support multiple
concurrent logged-in students. `GET /api/current-student` reports who's
logged in (used to render "Welcome, X" and to lock the student field on the
upload form), and `POST /api/logout` clears it.

## Agent Loop

The agent runs a strict PERCEIVE → REASON → ACT → OBSERVE loop for every
request. Every step is printed to the console with a labeled tag so the
reasoning is auditable.

### 1. PERCEIVE
Receives the uploaded photo, student ID, date, and meal slot. Logs:
```
[PERCEIVE] photo=<filename> studentId=<id> date=<date> mealSlot=<slot>
```

### 2. REASON
- Looks up the official menu for that date and meal slot in `menu.json`.
- Looks up the student's biometric attendance record in `biometric.json` for
  that exact date and meal slot.
- Sends the photo to **Gemini Vision** along with the list of menu items,
  instructing it to return only the core food item name (max 2-3 words, no
  cooking method/color/texture/sauce descriptions — e.g. "broccoli" instead
  of "broccoli florets steamed"), since that's far easier to match against
  `menu.json` accurately. It tries a list of model names in order
  (`gemini-3.6-flash`, `gemini-2.0-flash`, `gemini-2.0-flash-exp`,
  `gemini-1.5-flash-latest`, `gemini-pro-vision`) and uses the first one that
  responds, since model availability varies by API key/project.
- Logs the menu and the biometric result, plus explicit debug lines —
  `[DEBUG] Menu items for this slot`, `[DEBUG] Gemini identified`, and a
  `[DEBUG] Match found: yes/no` line per identified item — so a mismatch can
  be diagnosed directly from the console.

### 3. ACT
- If every check passes, matches each of Gemini's `identified_items` against
  the menu item list on **core nouns only**: cooking-method/texture/filler
  words ("steamed", "fried", "with", "and", etc.) are stripped from both
  sides first, so a shared descriptor alone (e.g. "steamed" in both
  "broccoli florets steamed" and "Steamed Rice") can't cause a false match.
- For each identified item, only the single **best**-matching menu item is
  billed — the candidate with the most core words in common (ties broken
  toward the more specific/longer menu entry) — and the same menu item is
  never billed twice, so one detected food always produces exactly one line
  item instead of every loosely-related menu entry.
- Prices each matched item using the pricing rules, sums the total, and
  saves a line item to `bills.json` under the student's record.
- If any check fails, no bill is created — instead a flag is raised with a
  specific reason (see below).
- Pricing for `Evening Snacks` uses its own rule set instead of the regular
  categories: Tea/Coffee items are ₹10, the main snack item (Maggi, Peanut
  Chana Chat, Masala Bhel, etc.) is ₹25, and accompaniments (chutney,
  ketchup, sev, lemon) are ₹5.
- `biometric.json` stores the Evening Snacks attendance flag under the key
  `evening_snacks` (snake_case) rather than `Evening Snacks`, so the agent
  maps the meal slot name to that key before looking up presence.

### 4. OBSERVE
Final gate before responding: even if items were priced, the agent double
checks image quality and confidence before committing to an "approved"
result. If anything is below threshold, it overrides the outcome to
"flagged" instead of billing.

## Flag Conditions

| Flag code | Trigger |
|---|---|
| `UNKNOWN_STUDENT` | Student name does not exist in `biometric.json` |
| `NO_MENU` | No menu entry exists for the given date/meal slot |
| `NO_BIOMETRIC` | Biometric record is missing or `false` (student not scanned/present) |
| `GEMINI_ERROR` | Every candidate Gemini model failed, or the response was unparseable — surfaced to the student as "AI analysis failed - please try again or contact support" |
| `IMAGE_UNCLEAR` | Gemini reports the photo is blurry, dark, or not food |
| `LOW_CONFIDENCE` | Gemini's confidence score is below `0.6` |
| `MENU_MISMATCH` | **None** of the identified items overlap with the day's menu at all — matching is deliberately fuzzy (case-insensitive, substring, and shared-significant-word), so a single overlapping item is enough to avoid this flag |

Any flagged meal is **not** billed and does not create a `bills.json` entry.
A student can use the "Raise an Issue" form on the results page to report a
disagreement — there is no email involved at all; it's saved as an entry in
`issues.json` (student name, date, meal slot, issue type, description,
timestamp) and the student sees "Your issue has been submitted successfully."

## Output Format

**Approved:**
```json
{
  "status": "approved",
  "items": [
    { "name": "Jeera Rice", "category": "Rice Bowl", "price": 30 },
    { "name": "Phulka", "category": "Phulka", "price": 5 }
  ],
  "total": 35,
  "detectedItems": ["Jeera Rice", "Phulka"],
  "confidence": 0.87
}
```

**Flagged:**
```json
{
  "status": "flagged",
  "reason": "No biometric scan found confirming presence at this meal",
  "flagCode": "NO_BIOMETRIC",
  "menuItems": ["Cornflakes", "Hot & Cold Milk", "..."]
}
```

## Billing

- Every **approved** meal appends one line item to `bills.json` for that
  student. There is no email functionality anywhere in the app.
- The **quarterly bill** page (`/quarterly-bill`) sums all of a student's
  saved entries and displays them on screen — there's no "send" action, just
  a read-only summary.
