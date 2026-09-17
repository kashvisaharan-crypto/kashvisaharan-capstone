require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { connectFilesystemMCP, readJSONViaMCP, writeJSONViaMCP } = require('./mcpClient');

const PORT = process.env.PORT || 3000;
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const BILLS_PATH = path.join(__dirname, 'bills.json');
const ISSUES_PATH = path.join(__dirname, 'issues.json');
const CONFIDENCE_THRESHOLD = 0.6;

// Single in-memory "session" — no auth tokens, no cookies, just whichever
// student last logged in. Fine for a single-user demo, not for real multi-user auth.
let loggedInStudent = null;

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(BILLS_PATH)) fs.writeFileSync(BILLS_PATH, '{}');
if (!fs.existsSync(ISSUES_PATH)) fs.writeFileSync(ISSUES_PATH, '[]');

// ---------- data loading (via MCP) ----------
// menu and biometric start undefined and get set by initMCPData() below,
// which runs before the server starts listening.
let menu;
let biometric;

async function initMCPData() {
  await connectFilesystemMCP(__dirname);
  menu = await readJSONViaMCP(path.join(__dirname, 'menu.json'));
  biometric = await readJSONViaMCP(path.join(__dirname, 'biometric.json'));
  console.log('[MCP] menu.json and biometric.json loaded via filesystem MCP server');
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

// Cooking-method/texture/filler words stripped before matching, so a shared
// descriptor (e.g. "steamed" in both "broccoli florets steamed" and
// "Steamed Rice") can't cause a false match on its own.
const DESCRIPTORS = new Set(['steamed', 'fried', 'fresh', 'cooked', 'light', 'sliced', 'chopped', 'roasted', 'boiled', 'grilled', 'with', 'and', 'in', 'a', 'the', 'of', 'or']);

function normalize(str) {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

// The remaining significant words after stripping descriptors — this is the
// "core noun" used for matching, e.g. "broccoli florets steamed" -> ["broccoli", "florets"].
function coreWords(str) {
  return normalize(str).split(' ').filter(w => w && !DESCRIPTORS.has(w));
}

// A meal should only be flagged when NONE of the identified items' core
// nouns overlap with the menu at all — this checks core-word overlap only,
// so shared descriptors alone (like "steamed") can't count as a match.
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

// Picks the single best menu item for one detected food: the candidate with
// the most core words in common with the detected item (ties broken in
// favor of the more specific/longer menu entry), so each detected food bills
// exactly one menu line instead of every loosely-related entry.
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

// gemini-1.5-flash has been deprecated on some API keys/projects (404s).
// Try these in order and stick with whichever one actually responds.
// gemini-3.6-flash is first because Google's own 404 response for
// gemini-2.0-flash explicitly names it as the current replacement.
const GEMINI_MODEL_CANDIDATES = ['gemini-3.6-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-exp', 'gemini-1.5-flash-latest', 'gemini-pro-vision'];

function extractJSON(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Gemini response did not contain JSON');
  return JSON.parse(match[0]);
}

async function analyzeImageWithGemini(filePath, mimeType, menuItems, mealSlot, date) {
  const imageBuffer = fs.readFileSync(filePath);
  const imagePart = { inlineData: { data: imageBuffer.toString('base64'), mimeType } };

  const prompt = `You are analyzing a photo of a student's meal tray from a university dining hall.
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
      const result = await model.generateContent([prompt, imagePart]);
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
async function analyzeMeal({ studentId, date, mealSlot, filePath, mimeType }) {
  console.log('\n========== NEW MEAL ANALYSIS ==========');
  console.log(`[PERCEIVE] photo=${path.basename(filePath)} studentId=${studentId} date=${date} mealSlot=${mealSlot}`);

  const student = biometric[studentId];
  if (!student) {
    console.log('[OBSERVE] Flag -> unknown student ID');
    return { status: 'flagged', reason: 'Unknown student ID', flagCode: 'UNKNOWN_STUDENT' };
  }

  const dayMenu = menu[date];
  const expectedItems = dayMenu ? dayMenu[mealSlot] : null;
  if (!expectedItems) {
    console.log('[OBSERVE] Flag -> no menu entry for this date/meal slot');
    return { status: 'flagged', reason: 'No menu entry found for the selected date and meal slot', flagCode: 'NO_MENU' };
  }
  console.log(`[REASON] Menu for ${dayMenu.day} ${mealSlot}: ${expectedItems.join(', ')}`);
  console.log('[DEBUG] Menu items for this slot:', expectedItems);

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
    return { status: 'flagged', reason: 'AI analysis failed - please try again or contact support', flagCode: 'GEMINI_ERROR', menuItems: expectedItems };
  }
  console.log(`[REASON] Gemini confidence=${analysis.confidence} imageQuality=${analysis.imageQuality}`);
  console.log('[DEBUG] Gemini identified:', analysis.identified_items);

  if (analysis.imageQuality === 'unclear') {
    console.log('[OBSERVE] Flag -> image unclear');
    return { status: 'flagged', reason: 'Image is unclear and cannot be reliably analyzed', flagCode: 'IMAGE_UNCLEAR', menuItems: expectedItems, detectedItems: analysis.identified_items, confidence: analysis.confidence };
  }
  if (typeof analysis.confidence !== 'number' || analysis.confidence < CONFIDENCE_THRESHOLD) {
    console.log('[OBSERVE] Flag -> low confidence');
    return { status: 'flagged', reason: `Low confidence (${analysis.confidence}) in food identification`, flagCode: 'LOW_CONFIDENCE', menuItems: expectedItems, detectedItems: analysis.identified_items, confidence: analysis.confidence };
  }

  const identifiedItems = Array.isArray(analysis.identified_items) ? analysis.identified_items : [];

  // One menu line per detected food: pick the single best-matching menu item
  // for each item Gemini identified, and never bill the same menu item twice.
  const matchedMenuItems = [];
  for (const detectedItem of identifiedItems) {
    const best = bestMenuMatch(expectedItems, detectedItem);
    console.log(`[DEBUG] Match found: ${best ? 'yes' : 'no'} for "${detectedItem}"${best ? ` (-> ${best})` : ''}`);
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
  bills[studentId] = bills[studentId] || [];
  const entry = {
    id: `${studentId}-${date}-${mealSlot}-${Date.now()}`,
    date,
    mealSlot,
    items,
    total,
    confidence: analysis.confidence,
    timestamp: new Date().toISOString()
  };
  bills[studentId].push(entry);
  await saveJSON(BILLS_PATH, bills);
  console.log('[ACT] Bill entry saved');

  return { status: 'approved', items, total, detectedItems: identifiedItems, confidence: analysis.confidence };
}

// ---------- Express app ----------
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({ dest: UPLOADS_DIR });

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/quarterly-bill', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'quarterly.html'));
});

app.get('/api/students', (req, res) => {
  const students = Object.entries(biometric).map(([id, s]) => ({ id, name: s.name }));
  res.json(students);
});

app.get('/api/menu-slots/:date', (req, res) => {
  const dayMenu = menu[req.params.date];
  if (!dayMenu) return res.json({ date: req.params.date, day: null, slots: [] });
  const slots = Object.keys(dayMenu).filter(k => k !== 'day');
  res.json({ date: req.params.date, day: dayMenu.day, slots });
});

app.post('/api/analyze', upload.single('photo'), async (req, res) => {
  try {
    const { studentId, date, mealSlot } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No photo uploaded' });
    if (!studentId || !date || !mealSlot) return res.status(400).json({ error: 'studentId, date and mealSlot are required' });

    const result = await analyzeMeal({
      studentId,
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

app.get('/api/quarterly-bill/:studentId', async (req, res) => {
  const student = biometric[req.params.studentId];
  if (!student) return res.status(404).json({ error: 'Student not found' });
  const bills = await loadJSON(BILLS_PATH, {});
  const entries = bills[req.params.studentId] || [];
  const total = entries.reduce((sum, e) => sum + e.total, 0);
  res.json({ studentId: req.params.studentId, name: student.name, entries, total });
});

app.post('/api/raise-issue', async (req, res) => {
  const { studentName, date, mealSlot, issueType, description } = req.body;
  const timestamp = new Date().toISOString();

  const issues = await loadJSON(ISSUES_PATH, []);
  issues.push({
    studentName: studentName || 'N/A',
    date: date || 'N/A',
    mealSlot: mealSlot || 'N/A',
    issueType,
    description: description || '',
    timestamp
  });
  await saveJSON(ISSUES_PATH, issues);

  res.json({ success: true });
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/api/login', (req, res) => {
  const { name, studentId } = req.body;
  const student = biometric[name];

  if (!student || String(student.studentId) !== String(studentId || '').trim()) {
    return res.status(401).json({ success: false, error: 'Incorrect Student ID. Please try again.' });
  }

  loggedInStudent = name;
  res.json({ success: true, name });
});

app.post('/api/logout', (req, res) => {
  loggedInStudent = null;
  res.json({ success: true });
});

app.get('/api/current-student', (req, res) => {
  res.json({ name: loggedInStudent });
});

initMCPData().then(() => {
  app.listen(PORT, () => {
    console.log(`Meal Billing Agent running at http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('[MCP] Failed to initialize filesystem MCP connection:', err);
  process.exit(1);
});
