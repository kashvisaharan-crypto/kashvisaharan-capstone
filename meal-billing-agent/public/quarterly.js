const quarterSelect = document.getElementById('quarterSelect');
const billCard = document.getElementById('billCard');
const studentName = document.getElementById('studentName');
const billBody = document.getElementById('billBody');
const billTotal = document.getElementById('billTotal');
const issueCard = document.getElementById('issueCard');
const issueContext = document.getElementById('issueContext');
const issueForm = document.getElementById('issueForm');
const issueStatus = document.getElementById('issueStatus');
const cancelIssueBtn = document.getElementById('cancelIssueBtn');

let currentIssueContext = null;

function formatQuarterLabel(quarterKey) {
  // "2026-Q3" -> "Q3 2026 (Jul-Sep)"
  const [year, q] = quarterKey.split('-Q');
  const monthRanges = { 1: 'Jan-Mar', 2: 'Apr-Jun', 3: 'Jul-Sep', 4: 'Oct-Dec' };
  return `Q${q} ${year} (${monthRanges[q]})`;
}

async function loadBill(quarter) {
  const url = quarter ? `/api/quarterly-bill?quarter=${encodeURIComponent(quarter)}` : '/api/quarterly-bill';
  const res = await fetch(url);
  if (!res.ok) {
    billCard.classList.add('hidden');
    return;
  }
  const data = await res.json();

  if (quarterSelect.options.length === 0) {
    quarterSelect.innerHTML = data.availableQuarters
      .map(q => `<option value="${q}">${formatQuarterLabel(q)}</option>`)
      .join('');
    quarterSelect.value = data.quarter;
  }

  studentName.textContent = `${data.name} — ${formatQuarterLabel(data.quarter)}`;

  if (data.entries.length === 0) {
    billBody.innerHTML = '<tr><td colspan="5">No approved meals recorded for this quarter.</td></tr>';
  } else {
    billBody.innerHTML = data.entries.map((e, i) =>
      `<tr>
        <td>${e.date}</td>
        <td>${e.mealSlot}</td>
        <td>${e.items.map(item => item.name).join(', ')}</td>
        <td>₹${e.total}</td>
        <td><button type="button" class="secondary raise-issue-row-btn" data-date="${e.date}" data-meal="${e.mealSlot}">Raise Issue</button></td>
      </tr>`
    ).join('');
  }
  billTotal.textContent = `₹${data.total}`;
  billCard.classList.remove('hidden');

  // Wire up each row's Raise Issue button.
  document.querySelectorAll('.raise-issue-row-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentIssueContext = { date: btn.dataset.date, mealSlot: btn.dataset.meal };
      issueContext.textContent = `Regarding: ${currentIssueContext.date} — ${currentIssueContext.mealSlot}`;
      issueStatus.textContent = '';
      issueCard.classList.remove('hidden');
      issueCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });
}

quarterSelect.addEventListener('change', () => loadBill(quarterSelect.value));

cancelIssueBtn.addEventListener('click', () => {
  issueCard.classList.add('hidden');
  issueForm.reset();
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
        date: currentIssueContext ? currentIssueContext.date : '',
        mealSlot: currentIssueContext ? currentIssueContext.mealSlot : '',
        issueType,
        description
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to submit issue');

    if (data.emailWarning) {
      issueStatus.textContent = `Your issue was saved, but the email notification could not be sent: ${data.emailWarning}`;
    } else {
      issueStatus.textContent = 'Your issue has been submitted and a confirmation email was sent to you.';
    }
    issueForm.reset();
  } catch (err) {
    issueStatus.textContent = 'Error: ' + err.message;
  }
});

initAuthNav({ requireLogin: true }).then(() => {
  loadBill();
});
