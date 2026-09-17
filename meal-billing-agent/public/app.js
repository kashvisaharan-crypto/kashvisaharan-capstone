const studentIdInput = document.getElementById('studentId');
const dateInput = document.getElementById('date');
const mealSlotSelect = document.getElementById('mealSlot');
const mealSlotError = document.getElementById('mealSlotError');
const analyzeForm = document.getElementById('analyzeForm');
const loading = document.getElementById('loading');
const resultBanner = document.getElementById('resultBanner');
const breakdownCard = document.getElementById('breakdownCard');
const breakdownBody = document.getElementById('breakdownBody');
const totalCost = document.getElementById('totalCost');
const resultActions = document.getElementById('resultActions');
const raiseIssueBtn = document.getElementById('raiseIssueBtn');
const issueCard = document.getElementById('issueCard');
const issueForm = document.getElementById('issueForm');
const issueStatus = document.getElementById('issueStatus');

let currentContext = null;

// Meal slots become selectable this many hours into the day. Slots with no
// entry here (none currently) are treated as always available once the date
// itself is valid.
const SLOT_START_HOUR = {
  'Breakfast': 7,
  'Brunch': 7,
  'Lunch': 12,
  'Evening Snacks': 16,
  'Dinner': 19
};

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function isSlotAvailableNow(slot, dateStr) {
  const today = todayStr();
  if (dateStr < today) return true;
  if (dateStr > today) return false;
  const startHour = SLOT_START_HOUR[slot];
  if (startHour === undefined) return true;
  return new Date().getHours() >= startHour;
}

initAuthNav({ requireLogin: true }).then(name => {
  if (name) studentIdInput.value = name;
});

async function refreshMealSlots() {
  mealSlotError.classList.add('hidden');
  const date = dateInput.value;
  if (!date) {
    mealSlotSelect.innerHTML = '';
    return;
  }

  const res = await fetch(`/api/menu-slots/${date}`);
  const data = await res.json();
  const validSlots = data.slots.filter(slot => isSlotAvailableNow(slot, date));

  if (validSlots.length === 0) {
    mealSlotSelect.innerHTML = '<option value="">No meal slots available yet</option>';
  } else {
    mealSlotSelect.innerHTML = validSlots.map(s => `<option value="${s}">${s}</option>`).join('');
  }
}

// Only the max date is restricted (to today) — students can go back to any
// past date to log a meal retroactively.
dateInput.max = todayStr();
dateInput.value = todayStr();
dateInput.addEventListener('change', refreshMealSlots);
refreshMealSlots();

analyzeForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = new FormData(analyzeForm);
  const studentId = formData.get('studentId');
  const date = formData.get('date');
  const mealSlot = formData.get('mealSlot');

  if (!mealSlot || !isSlotAvailableNow(mealSlot, date)) {
    mealSlotError.textContent = 'This meal slot has not started yet.';
    mealSlotError.classList.remove('hidden');
    return;
  }

  resultBanner.className = 'banner hidden';
  breakdownCard.classList.add('hidden');
  resultActions.classList.add('hidden');
  issueCard.classList.add('hidden');
  loading.classList.remove('hidden');

  try {
    const res = await fetch('/api/analyze', { method: 'POST', body: formData });
    const data = await res.json();
    loading.classList.add('hidden');

    if (!res.ok) {
      resultBanner.className = 'banner flagged';
      resultBanner.textContent = data.error || 'Something went wrong';
      resultBanner.classList.remove('hidden');
      return;
    }

    currentContext = { studentId, studentName: studentId, date, mealSlot };

    if (data.status === 'approved') {
      resultBanner.className = 'banner approved';
      resultBanner.textContent = `Approved — confidence ${(data.confidence * 100).toFixed(0)}%`;
      breakdownBody.innerHTML = data.items.map(i => `<tr><td>${i.name}</td><td>${i.category}</td><td>₹${i.price}</td></tr>`).join('');
      totalCost.textContent = `₹${data.total}`;
      breakdownCard.classList.remove('hidden');
    } else {
      resultBanner.className = 'banner flagged';
      resultBanner.textContent = `Flagged for review — ${data.reason}`;
    }
    resultBanner.classList.remove('hidden');
    resultActions.classList.remove('hidden');
  } catch (err) {
    loading.classList.add('hidden');
    resultBanner.className = 'banner flagged';
    resultBanner.textContent = 'Error: ' + err.message;
    resultBanner.classList.remove('hidden');
  }
});

raiseIssueBtn.addEventListener('click', () => {
  issueCard.classList.toggle('hidden');
  issueStatus.textContent = '';
});

issueForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  issueStatus.textContent = 'Submitting...';

  const issueType = document.getElementById('issueType').value;
  const description = document.getElementById('issueDescription').value;

  try {
    const res = await fetch('/api/raise-issue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentName: currentContext ? currentContext.studentName : '',
        date: currentContext ? currentContext.date : '',
        mealSlot: currentContext ? currentContext.mealSlot : '',
        issueType,
        description
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to submit issue');
    issueStatus.textContent = 'Your issue has been submitted successfully.';
    issueForm.reset();
  } catch (err) {
    issueStatus.textContent = 'Error: ' + err.message;
  }
});
