# Build Log

## Entry 1
- Date: 2026-09-11
- Time Spent: 30 mins
- Tokens Used: 3k
- What Shipped: Locked in capstone idea (Biometric-Based Mess Billing System). Drafted plan.md with MVP scope, final goals, and AI Involvement Level. Set up repo structure on plan/setup branch. Opened PR to main for review.

## Entry 2
- Date: 2026-09-17
- Time Spent: 1 hour
- Tokens Used: 25k
- What Shipped: Built meal billing agent web app with Gemini vision analysis, biometric attendance check, menu cross-reference, login system, raise-an-issue feature, and quarterly bill page. Built the perceive-reason-act-observe agent loop, visible live in server console logs: PERCEIVE (photo + date/meal uploaded), REASON (biometric check, Gemini Vision food identification, menu cross-check), ACT (itemized cost calculation), OBSERVE (flag for human review if attendance missing, confidence low, or menu mismatch).
- What Broke: Gemini model name gemini-1.5-flash returned 404. Fixed by switching to gemini-2.0-flash. Menu matching was too strict initially, flagging all photos. Fixed by implementing fuzzy word matching with descriptor-word stripping (e.g. "steamed", "fried") so cooking-method words alone couldn't cause false matches.

## Entry 3
- Date: 2026-09-17
- Time Spent: 1-2 hours
- Tokens Used: 51k
- What Shipped: Integrated a real MCP (Model Context Protocol) connector into the meal billing agent, replacing plain Node.js fs.readFileSync/writeFileSync calls with genuine calls to the official @modelcontextprotocol/server-filesystem via the MCP SDK, verified with a live client-server handshake before integration. Restructured Assessment 2 work into two separate branches, each with its own PR (agent/meal-billing-core and docs/build-log-assessment-2), per the git discipline requirement. Regenerated an exposed Gemini API key and revoked an exposed GitHub token found during this session.
- What Broke: A prior session had hand-edited menu.json to include the exact food items in the test photo (pasta, broccoli, apple), guaranteeing an artificial "Approved" match instead of testing the agent honestly. Caught this by inspecting menu.json directly and noticing items that didn't appear in the real uploaded weekly menu photo. Fixed by writing a script to remove the 10 fabricated entries, restoring menu.json to only the real published menu. Re-ran the same test photo afterward: the agent correctly flagged it as "Food in photo does not match items on the weekly menu" — the honest, correct result, since pasta/broccoli/apple were never actually on that day's real menu.

## Entry 4
- Date: 2026-09-18
- Time Spent: 1-2 hours
- Tokens Used: 100k

- What Shipped: Brought the Assessment 2 agent mechanism into the actual capstone MVP. Replaced manual student selection with real Google OAuth login restricted to @flame.edu.in accounts, using the student's unique email (not name) as the identity key throughout - solving the duplicate-name problem directly rather than working around it. Scaled the student roster from 10 to 100, including 3 genuine name collisions, to concretely test that solution. Added categorized issue types to the Raise an Issue form and wired up real Gmail API email notifications, sent as the student themselves (using the gmail.send OAuth scope granted at login) - one email to the hostel office, one confirmation back to the student. Redesigned the quarterly bill page as self-service (a student only ever sees their own bill) with real calendar-quarter grouping and a selector for past quarters. Hardened the Gemini Vision call against a previously-unhandled failure case: an API request could hang indefinitely with no feedback; added a 15-second timeout via AbortController so a hang now fails fast and falls through to the next model candidate instead of leaving the student stuck.
- What Broke: The OAuth redirect URI registered in Google Cloud Console (/auth/callback) didn't match what the app actually sent (/auth/google/callback), causing a redirect_uri_mismatch error on first login attempt. Fixed by updating the registered URI to match the app's actual callback route. Separately, .env had two variables merged onto one line (GOOGLE_CALLBACK_URL and SESSION_SECRET), causing express-session to fail with "secret option required" since the merged value was being read as part of the wrong variable. Fixed by splitting them onto separate lines. Also discovered mid-build that the original Student-ID-confirmation step (designed to disambiguate duplicate names) was solving a problem that unique-email Google login already solves on its own - removed it as unnecessary complexity once recognized.

## Entry 5
- Date: 2026-09-19
- Time Spent: 30 mins
- Tokens Used: 23k
- What Shipped: Redesigned the app's UI to match FLAME University's actual branding. Extracted exact brand colors (navy #1E456C, gold #F2B743) programmatically from the real FLAME logo and a design reference image rather than guessing them. Rebuilt the login page to match the university's own portal login structure: logo seamless on a plain white background, no card border around it, navy heading text, Google-only sign-in. Removed dark mode entirely so the site stays plain white/light regardless of system settings. Redesigned the top nav from a solid navy strip to a white bar with the real logo and navy text links. Added a full-page decorative background image (a commissioned line-art illustration) to the upload and quarterly bill pages, with content held in a white padded box on top for legibility, sized with CSS background-cover so it scales cleanly across screen sizes without pixelating.
- What Broke: Nothing broke technically, but an early instruction ("white heading text, no navy anywhere") was self-contradictory - white text has no readable background without a colored element behind it. Caught this before building anything by asking for clarification rather than guessing, which the final reference image resolved directly (navy heading text, not white).

## Entry 6
- Date: 2026-09-19
- Time Spent: 45 mins
- Tokens Used:60k
- What Shipped: Deployed the app to production on Render (free tier), including build/start command configuration, environment variable setup, and switching the OAuth callback and app URLs from localhost to the live domain. Removed the roster-membership restriction from login: any real @flame.edu.in Google account can now sign in, not just the 100 sample students in biometric.json - a student outside that sample set can still log in and use the app, with missing attendance data handled as an existing flagged case rather than a login block.
- What Broke: Google OAuth repeatedly failed with redirect_uri_mismatch even though the registered URI and the app's configured URI appeared identical on both sides. Root cause was an invisible artifact from copy-pasting the URI into Google Cloud Console's field; deleting the saved URI entirely and manually retyping it character-by-character resolved it. Separately, an environment variable name was typo'd (SESSION_SECRE instead of SESSION_SECRET) during manual entry on Render, which broke session handling until caught and corrected.

**Running Totals (across all entries):**
- Total time spent: approximately 5.5-6 hours
- Total tokens used: 262k 
