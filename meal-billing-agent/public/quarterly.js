const studentSelect = document.getElementById('studentId');
const billCard = document.getElementById('billCard');
const studentName = document.getElementById('studentName');
const billBody = document.getElementById('billBody');
const billTotal = document.getElementById('billTotal');

async function loadStudents() {
  const res = await fetch('/api/students');
  const students = await res.json();
  studentSelect.innerHTML = '<option value="">-- Select a student --</option>' +
    students.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
}

async function loadBill(studentId) {
  if (!studentId) {
    billCard.classList.add('hidden');
    return;
  }
  const res = await fetch(`/api/quarterly-bill/${encodeURIComponent(studentId)}`);
  const data = await res.json();

  studentName.textContent = data.name;
  billBody.innerHTML = data.entries.map(e =>
    `<tr><td>${e.date}</td><td>${e.mealSlot}</td><td>${e.items.map(i => i.name).join(', ')}</td><td>₹${e.total}</td></tr>`
  ).join('') || '<tr><td colspan="4">No approved meals recorded yet.</td></tr>';
  billTotal.textContent = `₹${data.total}`;
  billCard.classList.remove('hidden');
}

studentSelect.addEventListener('change', () => loadBill(studentSelect.value));

initAuthNav({ requireLogin: false });
loadStudents();
