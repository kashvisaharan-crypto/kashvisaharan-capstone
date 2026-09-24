require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const session = require('express-session');
const passport = require('passport');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { connectFilesystemMCP, readJSONViaMCP, writeJSONViaMCP, readTextViaMCP } = require('./mcpClient');
const { configurePassport, requireFullLogin, ALLOWED_DOMAIN } = require('./auth');
const { sendAsUser } = require('./emailSender');

const PORT = process.env.PORT || 3000;
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const BILLS_PATH = path.join(__dirname, 'bills.json');
const ISSUES_PATH = path.join(__dirname, 'issues.json');
const CONFIDENCE_THRESHOLD = 0.6;

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(BILLS_PATH)) fs.writeFileSync(BILLS_PATH, '{}');
if (!fs.existsSync(ISSUES_PATH)) fs.writeFileSync(ISSUES_PATH, '[]');

// ---------- data loading (via MCP) ----------
let menu;
let biometric;
let skillInstructions;

async function initMCPData() {
  await connectFilesystemMCP(__dirname);
  menu = await readJSONViaMCP(path.join(__dirname, 'menu.json'));
  biometric = await readJSONViaMCP(path.join(__dirname, 'biometric.json'));
  skillInstructions = await readTextViaMCP(path.join(__dirname, 'skill.md'));
  console.log('[MCP] menu.json, biometric.json, and skill.md loaded via filesystem MCP server');

  // Passport needs the biometric roster to validate logins against, so we
  // configure it only after biometric.json has actually loaded.
  configurePassport(biometric);
}

async function loadJSON(filePath, fallback) {
  try {
    return await readJSONViaMCP(filePath);
  } catch (err) {
    return fallback;
  }
}
async function saveJSON(filePath, data) {
  await writeJSONViaMCP(filePath, data);
}

// ---------- pricing ----------
const PRICING = {
  cereal: 20,
  milk: 15,
  teaCoffee: 10,
  juiceDrink: 15,
  breadSlice: 5,
  butterJam: 5,
  indianBreakfast: 30,
  accompaniment: 5,
  salad: 15,
  starter: 25,
  riceBowl: 30,
  mainAccompaniment: 35,
  dal: 20,
  rice: 15,
  phulka: 5,
  curdRaita: 10,
  picklePapad: 5,
  sweetDessert: 25,
  soup: 20,
  sideDish: 20,
  snackTeaCoffee: 10,
  mainSnackItem: 25,
  snackAccompaniment: 5
};

const PRICE_RULES = [
  { category: 'Cereal/Flakes', price: PRICING.cereal, test: n => n.includes('flakes') },
  { category: 'Butter/Jam', price: PRICING.butterJam, test: n => (n.includes('butter') && !n.includes('butter milk') && !n.includes('buttermilk')) || n.includes('jam') },
  { category: 'Curd/Raita/Buttermilk', price: PRICING.curdRaita, test: n => n.includes('curd') || n.includes('raita') || n.includes('buttermilk') || n.includes('butter milk') },
  { category: 'Milk', price: PRICING.milk, test: n => n.includes('milk') },
  { category: 'Tea/Coffee', price: PRICING.teaCoffee, test: n => n.includes('tea') || n.includes('coffee') || n.includes('bournvita') },
  { category: 'Bread (per slice)', price: PRICING.breadSlice, test: n => n.includes('bread') && !n.includes('bread sticks') },
  { category: 'Pickle/Papad', price: PRICING.picklePapad, test: n => n.includes('pickle') || n.includes('papad') },
  { category: 'Starter', price: PRICING.starter, test: n => ['wada', 'samosa', 'pakoda', 'tempura', 'cheese ball', 'kachori', '65', 'arancini', 'crostini'].some(k => n.includes(k)) },
  { category: 'Phulka', price: PRICING.phulka, test: n => n === 'phulka' },
  { category: 'Dal', price: PRICING.dal, test: n => n.includes('dal') },
  { category: 'Rice Bowl', price: PRICING.riceBowl, test: n => ['pulao', 'biryani', 'fried rice', 'jeera rice', 'onion rice', 'pepper rice', 'oregano rice', 'garlic fried rice', 'noodles'].some(k => n.includes(k)) },
  { category: 'Rice', price: PRICING.rice, test: n => n.includes('rice') },
  { category: 'Soup', price: PRICING.soup, test: n => ['soup', 'chowder', 'shorba', 'rasam', 'manchow'].some(k => n.includes(k)) },
  { category: 'Salad', price: PRICING.salad, test: n => n.includes('salad') },
  { category: 'Sweet/Dessert', price: PRICING.sweetDessert, test: n => ['kheer', 'jamun', 'jalebi', 'barfi', 'mousse', 'payassam', 'payasam', 'malpua', 'kurma', 'ladoo', 'custard', 'icecream', 'cake', 'halwa', 'tukda', 'pastry', 'lancha'].some(k => n.includes(k)) },
  { category: 'Main Accompaniment', price: PRICING.mainAccompaniment, test: n => ['masala', 'handi', 'alfredo', 'kadai', 'chole', 'rajma', 'banarasi', 'chettinad', 'peshwari', 'zunka', 'bhaji', 'gassi', 'tofu', 'moong home style', 'dhaba', 'manchurian'].some(k => n.includes(k)) },
  { category: 'Indian Breakfast Item', price: PRICING.indianBreakfast, test: n => ['poori', 'upma', 'idly', 'poha', 'khichdi', 'uttapam', 'misal', 'pongal', 'ghee podi'].some(k => n.includes(k)) },
  { category: 'Juice/Drink', price: PRICING.juiceDrink, test: n => ['juice', 'tang', 'jaljeera', 'taak'].some(k => n.includes(k)) },
  { category: 'Accompaniment/Chutney', price: PRICING.accompaniment, test: n => n.includes('chutney') || n.includes('sambar') }
];

function getPriceForItem(name, mealSlot) {
  const n = name.toLowerCase();

  if (mealSlot === 'Evening Snacks') {
    if (n.includes('tea') || n.includes('coffee')) return { price: PRICING.snackTeaCoffee, category: 'Tea/Coffee' };
    if (['chutney', 'ketchup', 'sev', 'lemon'].some(k => n.includes(k))) return { price: PRICING.snackAccompaniment, category: 'Accompaniment' };
    return { price: PRICING.mainSnackItem, category: 'Main Snack Item' };
  }

  for (const rule of PRICE_RULES) {
    if (rule.test(n)) return { price: rule.price, category: rule.category };
  }
  return { price: PRICING.sideDish, category: 'Side Dish' };
}

function attendanceKeyForSlot(mealSlot) {
  return mealSlot === 'Evening Snacks' ? 'evening_snacks' : mealSlot;
}

const DESCRIPTORS = new Set(['steamed', 'fried', 'fresh', 'cooked', 'light', 'sliced', 'chopped', 'roasted', 'boiled', 'grilled', 'with', 'and', 'in', 'a', 'the', 'of', 'or']);

function normalize(str) {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function coreWords(str) {
  return normalize(str).split(' ').filter(w => w && !DESCRIPTORS.has(w));
}

function itemsRoughlyMatch(menuItem, detectedItem) {
  const menuCoreWords = coreWords(menuItem);
  const detectedCoreWords = coreWords(detectedItem);
  if (menuCoreWords.length === 0 || detectedCoreWords.length === 0) return false;
  const menuCore = menuCoreWords.join(' ');
  const detectedCore = detectedCoreWords.join(' ');
  if (menuCore.includes(detectedCore) || detectedCore.includes(menuCore)) return true;
  const detectedSet = new Set(detectedCoreWords);
  return menuCoreWords.some(w => detectedSet.has(w));
}

function bestMenuMatch(expectedItems, detectedItem) {
  const detectedSet = new Set(coreWords(detectedItem));
  let best = null;
  let bestScore = -1;
  let bestCoreCount = -1;

  for (const menuItem of expectedItems) {
    if (!itemsRoughlyMatch(menuItem, detectedItem)) continue;
    const menuCoreWordsArr = coreWords(menuItem);
    const score = menuCoreWordsArr.filter(w => detectedSet.has(w)).length;
    const coreCount = menuCoreWordsArr.length;
    if (score > bestScore || (score === bestScore && coreCount > bestCoreCount)) {
      best = menuItem;
      bestScore = score;
      bestCoreCount = coreCount;
    }
  }

  return best;
}

// ---------- Gemini ----------
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Model list updated based on live error messages from the Gemini API
// itself: gemini-2.0-flash, gemini-2.0-flash-exp, gemini-1.5-flash-latest,
// and gemini-pro-vision all returned 404 (discontinued by Google).
// gemini-3.8-flash is what Google's own 404 response explicitly names as
// the current replacement. gemini-3.6-flash is kept as a second option
// since it still exists, but has a low free-tier daily quota (20
// requests/day) and may be exhausted - not a code bug if so.
const GEMINI_MODEL_CANDIDATES = ['gemini-3.8-flash', 'gemini-3.6-flash'];

// Realistic failure case hardened here: Gemini can hang indefinitely on a
// slow network or an API-side slowdown, leaving the student staring at a
// spinner forever with no feedback. We cap each model attempt at 15 seconds
// using AbortController, so a hang degrades into a clear, fast failure
// (falls through to the next model, then eventually a clean "flagged"
// response) instead of hanging the whole request.
const GEMINI_TIMEOUT_MS = 15000;

function extractJSON(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Gemini response did not contain JSON');
  return JSON.parse(match[0]);
}

async function callGeminiWithTimeout(model, promptParts, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const result = await model.generateContent(promptParts, { signal: controller.signal });
    clearTimeout(timeoutId);
    return result;
  } catch (err) {
    clearTimeout(timeoutId);
    if (controller.signal.aborted) {
      throw new Error(`Gemini request timed out after ${timeoutMs / 1000}s`);
    }
    throw err;
  }
}

async function analyzeImageWithGemini(filePath, mimeType, menuItems, mealSlot, date) {
  const imageBuffer = fs.readFileSync(filePath);
  const imagePart = { inlineData: { data: imageBuffer.toString('base64'), mimeType } };

  const prompt = `You are an agent following this Skill definition exactly. Do not deviate from
the rules it sets, especially around flagging low-confidence or non-matching cases rather than
guessing:

--- SKILL DEFINITION (loaded via MCP from skill.md) ---
${skillInstructions}
--- END SKILL DEFINITION ---

You are analyzing a photo of a student's meal tray from a university dining hall.
The meal is "${mealSlot}" on ${date}. The official menu items served for this meal are:
${menuItems.map(i => `- ${i}`).join('\n')}

Look carefully at the photo and identify the general food items you can see on the tray.
Return only the core food item name, maximum 2-3 words. Do not include cooking method, color, texture, or sauce descriptions.
For example: instead of "penne pasta with light cream sauce and red pepper flakes", just return "penne pasta". Instead of "broccoli florets steamed", just return "broccoli". Instead of "apple slices with red skin", just return "apple".

If the tray is a bento box or divided into compartments, pay particular attention to whether these commonly-served items are present: penne pasta, broccoli, apple.

Respond with ONLY a JSON object, no markdown formatting, in this exact shape:
{
  "identified_items": ["item name", "item name"],
  "confidence": 0.0,
  "imageQuality": "clear",
  "notes": "brief explanation"
}

Where "confidence" is a number between 0 and 1 representing how confident you are in the identification, and "imageQuality" is either "clear" or "unclear" (use "unclear" if the photo is blurry, too dark, too far away, or does not show food).`;

  let lastError;
  for (const modelName of GEMINI_MODEL_CANDIDATES) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await callGeminiWithTimeout(model, [prompt, imagePart], GEMINI_TIMEOUT_MS);
      const text = result.response.text();
      return extractJSON(text);
    } catch (err) {
      console.log(`[REASON] Gemini model "${modelName}" failed: ${err.message}`);
      lastError = err;
    }
  }
  throw lastError;
}

// ---------- Agent loop ----------
async function analyzeMeal({ studentEmail, date, mealSlot, filePath, mimeType }) {
  console.log('\n========== NEW MEAL ANALYSIS ==========');
  console.log(`[PERCEIVE] photo=${path.basename(filePath)} studentEmail=${studentEmail} date=${date} mealSlot=${mealSlot}`);

  const student = biometric[studentEmail];
  if (!student) {
    console.log('[OBSERVE] Flag -> unknown student email');
    return { status: 'flagged', reason: 'Unknown student email', flagCode: 'UNKNOWN_STUDENT' };
  }

  const dayMenu = menu[date];
  const expectedItems = dayMenu ? dayMenu[mealSlot] : null;
  if (!expectedItems) {
    console.log('[OBSERVE] Flag -> no menu entry for this date/meal slot');
    return { status: 'flagged', reason: 'No menu entry found for the selected date and meal slot', flagCode: 'NO_MENU' };
  }
  console.log(`[REASON] Menu for ${dayMenu.day} ${mealSlot}: ${expectedItems.join(', ')}`);

  const present = student.attendance?.[date]?.[attendanceKeyForSlot(mealSlot)];
  console.log(`[REASON] Biometric record: ${present === true ? 'PRESENT' : present === false ? 'ABSENT' : 'NO RECORD'}`);
  if (present !== true) {
    console.log('[OBSERVE] Flag -> no biometric confirmation of presence');
    return { status: 'flagged', reason: 'No biometric scan found confirming presence at this meal', flagCode: 'NO_BIOMETRIC', menuItems: expectedItems };
  }

  console.log('[REASON] Sending photo to Gemini Vision for food identification...');
  let analysis;
  try {
    analysis = await analyzeImageWithGemini(filePath, mimeType, expectedItems, mealSlot, date);
  } catch (err) {
    console.log(`[OBSERVE] Flag -> Gemini analysis failed: ${err.message}`);
    return { status: 'flagged', reason: 'AI analysis failed or timed out - please try again', flagCode: 'GEMINI_ERROR', menuItems: expectedItems };
  }
  console.log(`[REASON] Gemini confidence=${analysis.confidence} imageQuality=${analysis.imageQuality}`);

  if (analysis.imageQuality === 'unclear') {
    console.log('[OBSERVE] Flag -> image unclear');
    return { status: 'flagged', reason: 'Image is unclear and cannot be reliably analyzed', flagCode: 'IMAGE_UNCLEAR', menuItems: expectedItems, detectedItems: analysis.identified_items, confidence: analysis.confidence };
  }
  if (typeof analysis.confidence !== 'number' || analysis.confidence < CONFIDENCE_THRESHOLD) {
    console.log('[OBSERVE] Flag -> low confidence');
    return { status: 'flagged', reason: `Low confidence (${analysis.confidence}) in food identification`, flagCode: 'LOW_CONFIDENCE', menuItems: expectedItems, detectedItems: analysis.identified_items, confidence: analysis.confidence };
  }

  const identifiedItems = Array.isArray(analysis.identified_items) ? analysis.identified_items : [];

  const matchedMenuItems = [];
  for (const detectedItem of identifiedItems) {
    const best = bestMenuMatch(expectedItems, detectedItem);
    if (best && !matchedMenuItems.includes(best)) {
      matchedMenuItems.push(best);
    }
  }

  if (matchedMenuItems.length === 0) {
    console.log('[OBSERVE] Flag -> detected food does not match the weekly menu');
    return { status: 'flagged', reason: 'Food in photo does not match items on the weekly menu', flagCode: 'MENU_MISMATCH', menuItems: expectedItems, detectedItems: identifiedItems, confidence: analysis.confidence };
  }

  console.log(`[ACT] Matched menu items: ${matchedMenuItems.join(', ')}`);
  const items = matchedMenuItems.map(name => {
    const { price, category } = getPriceForItem(name, mealSlot);
    return { name, category, price };
  });
  const total = items.reduce((sum, i) => sum + i.price, 0);
  console.log(`[ACT] Itemized total: ₹${total}`);

  const bills = await loadJSON(BILLS_PATH, {});
  bills[studentEmail] = bills[studentEmail] || [];
  const entry = {
    id: `${studentEmail}-${date}-${mealSlot}-${Date.now()}`,
    date,
    mealSlot,
    items,
    total,
    confidence: analysis.confidence,
    timestamp: new Date().toISOString()
  };
  bills[studentEmail].push(entry);
  await saveJSON(BILLS_PATH, bills);
  console.log('[ACT] Bill entry saved');

  return { status: 'approved', items, total, detectedItems: identifiedItems, confidence: analysis.confidence };
}

// ---------- Express app ----------
const app = express();
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({ dest: UPLOADS_DIR });

// ---------- Auth routes ----------
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/auth/google', passport.authenticate('google'));

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    res.redirect('/');
  }
);

app.post('/api/logout', (req, res) => {
  req.logout(() => {
    res.json({ success: true });
  });
});

app.get('/api/current-student', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    const student = biometric[req.user.email];
    res.json({
      name: req.user.name,
      email: req.user.email,
      studentId: student ? student.studentId : 'Not on file',
      inSampleRoster: !!student
    });
  } else {
    res.json({ name: null });
  }
});

// ---------- Main app routes (all require full login) ----------
app.get('/', (req, res) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.redirect('/login');
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/quarterly-bill', (req, res) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.redirect('/login');
  }
  res.sendFile(path.join(__dirname, 'public', 'quarterly.html'));
});

app.get('/api/menu-slots/:date', requireFullLogin, (req, res) => {
  const dayMenu = menu[req.params.date];
  if (!dayMenu) return res.json({ date: req.params.date, day: null, slots: [] });
  const slots = Object.keys(dayMenu).filter(k => k !== 'day');
  res.json({ date: req.params.date, day: dayMenu.day, slots });
});

app.post('/api/analyze', requireFullLogin, upload.single('photo'), async (req, res) => {
  try {
    const { date, mealSlot } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No photo uploaded' });
    if (!date || !mealSlot) return res.status(400).json({ error: 'date and mealSlot are required' });

    // studentEmail comes from the authenticated session, never from the
    // request body - a student can only ever bill themselves.
    const result = await analyzeMeal({
      studentEmail: req.user.email,
      date,
      mealSlot,
      filePath: req.file.path,
      mimeType: req.file.mimetype
    });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

function getQuarterKey(dateStr) {
  const [year, month] = dateStr.split('-').map(Number);
  const q = Math.ceil(month / 3);
  return `${year}-Q${q}`;
}

function getCurrentQuarterKey() {
  const now = new Date();
  return getQuarterKey(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`);
}

app.get('/api/quarterly-bill', requireFullLogin, async (req, res) => {
  const student = biometric[req.user.email];
  if (!student) return res.status(404).json({ error: 'Student not found' });

  const bills = await loadJSON(BILLS_PATH, {});
  const allEntries = bills[req.user.email] || [];

  // Group every entry into its real calendar quarter, so "past quarters"
  // reflects actual billing periods rather than an arbitrary window.
  const quarterMap = {};
  for (const entry of allEntries) {
    const qKey = getQuarterKey(entry.date);
    if (!quarterMap[qKey]) quarterMap[qKey] = [];
    quarterMap[qKey].push(entry);
  }

  const currentQuarter = getCurrentQuarterKey();
  const availableQuarters = Array.from(new Set([...Object.keys(quarterMap), currentQuarter])).sort().reverse();

  const requestedQuarter = req.query.quarter || currentQuarter;
  const entries = quarterMap[requestedQuarter] || [];
  const total = entries.reduce((sum, e) => sum + e.total, 0);

  res.json({
    name: student.name,
    quarter: requestedQuarter,
    availableQuarters,
    entries,
    total
  });
});

const ISSUE_OFFICE_EMAIL = 'student.design7@flame.edu.in';

app.post('/api/raise-issue', requireFullLogin, async (req, res) => {
  const { date, mealSlot, issueType, description } = req.body;
  const timestamp = new Date().toISOString();

  const issues = await loadJSON(ISSUES_PATH, []);
  const issueRecord = {
    studentName: req.user.name,
    studentEmail: req.user.email,
    date: date || 'N/A',
    mealSlot: mealSlot || 'N/A',
    issueType,
    description: description || '',
    timestamp
  };
  issues.push(issueRecord);
  await saveJSON(ISSUES_PATH, issues);

  // Send two emails as the student themselves (using the Gmail-send
  // permission granted at login): one to the hostel office, one back to
  // the student as a confirmation. If either fails - most likely because
  // the OAuth access token has expired - we still keep the issue saved
  // above, and report the email problem separately rather than losing the
  // student's report entirely.
  const officeEmailBody = `A new meal billing issue has been submitted.

Student: ${req.user.name} (${req.user.email})
Date: ${date || 'N/A'}
Meal Slot: ${mealSlot || 'N/A'}
Issue Type: ${issueType}

Description:
${description || '(no additional description provided)'}

Submitted: ${timestamp}`;

  const confirmationBody = `Hi ${req.user.name},

This confirms your issue has been submitted to the hostel mess office.

Issue Type: ${issueType}
Date: ${date || 'N/A'}
Meal Slot: ${mealSlot || 'N/A'}

We will review this and get back to you.

- Meal Billing Agent`;

  const officeResult = await sendAsUser({
    accessToken: req.user.accessToken,
    userEmail: req.user.email,
    to: ISSUE_OFFICE_EMAIL,
    subject: `Meal Billing Issue - ${req.user.name} - ${issueType}`,
    body: officeEmailBody
  });

  const confirmationResult = await sendAsUser({
    accessToken: req.user.accessToken,
    userEmail: req.user.email,
    to: req.user.email,
    subject: 'Your meal billing issue was submitted',
    body: confirmationBody
  });

  if (!officeResult.success || !confirmationResult.success) {
    // The issue is safely saved either way - only the email notification
    // step failed, which we surface honestly instead of pretending it
    // fully succeeded.
    return res.json({
      success: true,
      emailWarning: !officeResult.success ? officeResult.error : confirmationResult.error
    });
  }

  res.json({ success: true });
});

initMCPData().then(() => {
  app.listen(PORT, () => {
    console.log(`Meal Billing Agent running at http://localhost:${PORT}`);
    console.log(`Google OAuth restricted to @${ALLOWED_DOMAIN} accounts`);
  });
}).catch(err => {
  console.error('[MCP] Failed to initialize filesystem MCP connection:', err);
  process.exit(1);
});
