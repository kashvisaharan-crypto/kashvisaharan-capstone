# Build Log

## Entry 1
- Date: 2026-09-11
- Time Spent: 30 mins
- Tokens Used: 3k
- What Shipped: Locked in capstone idea (Biometric-Based Mess Billing System). Drafted plan.md with MVP scope, final goals, and AI Involvement Level. Set up repo structure on plan/setup branch. Opened PR to main for review.

## Entry 2
- Date: 2026-09-17
- Time Spent: 3 hours
- Tokens Used: ~25k
- What Shipped: Built meal billing agent web app with Gemini vision analysis, biometric attendance check, menu cross-reference, login system, raise-an-issue feature, and quarterly bill page. Built the perceive-reason-act-observe agent loop, visible live in server console logs: PERCEIVE (photo + date/meal uploaded), REASON (biometric check, Gemini Vision food identification, menu cross-check), ACT (itemized cost calculation), OBSERVE (flag for human review if attendance missing, confidence low, or menu mismatch).
- What Broke: Gemini model name gemini-1.5-flash returned 404. Fixed by switching to gemini-2.0-flash. Menu matching was too strict initially, flagging all photos. Fixed by implementing fuzzy word matching with descriptor-word stripping (e.g. "steamed", "fried") so cooking-method words alone couldn't cause false matches.

## Entry 3
- Date: 2026-09-17
- Time Spent: 1-2 hours
- Tokens Used: ~51k
- What Shipped: Integrated a real MCP (Model Context Protocol) connector into the meal billing agent, replacing plain Node.js fs.readFileSync/writeFileSync calls with genuine calls to the official @modelcontextprotocol/server-filesystem via the MCP SDK, verified with a live client-server handshake before integration. Restructured Assessment 2 work into two separate branches, each with its own PR (agent/meal-billing-core and docs/build-log-assessment-2), per the git discipline requirement. Regenerated an exposed Gemini API key and revoked an exposed GitHub token found during this session.
- What Broke: A prior session had hand-edited menu.json to include the exact food items in the test photo (pasta, broccoli, apple), guaranteeing an artificial "Approved" match instead of testing the agent honestly. Caught this by inspecting menu.json directly and noticing items that didn't appear in the real uploaded weekly menu photo. Fixed by writing a script to remove the 10 fabricated entries, restoring menu.json to only the real published menu. Re-ran the same test photo afterward: the agent correctly flagged it as "Food in photo does not match items on the weekly menu" — the honest, correct result, since pasta/broccoli/apple were never actually on that day's real menu.

