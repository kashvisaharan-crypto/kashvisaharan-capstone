// Sends emails via the Gmail API, authenticated as the currently logged-in
// student - using the access token granted during their Google OAuth login
// (the gmail.send scope was requested there). No separate admin credentials
// needed: the student's own consent is what makes this possible.
//
// Known limitation, handled gracefully rather than silently: Google access
// tokens typically expire after about an hour. If a student's session has
// been open a long time, a send can fail with an auth error. We catch that
// specifically and return a clear, actionable message instead of a generic
// crash - this is a deliberate, realistic failure case handled on purpose.

const { google } = require('googleapis');

function buildRawMessage({ to, from, subject, body }) {
  const messageParts = [
    `To: ${to}`,
    `From: ${from}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    body
  ];
  const message = messageParts.join('\n');
  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function sendAsUser({ accessToken, userEmail, to, subject, body }) {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const raw = buildRawMessage({ to, from: userEmail, subject, body });

  try {
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw }
    });
    return { success: true };
  } catch (err) {
    const status = err.response?.status;
    if (status === 401 || status === 403) {
      // Expired or insufficient-scope token - a real, expected failure mode,
      // not a bug. Tell the student exactly what to do.
      return {
        success: false,
        error: 'Your login session has expired for sending email. Please log out and sign in again, then resubmit your issue.'
      };
    }
    return { success: false, error: 'Could not send email notification: ' + err.message };
  }
}

module.exports = { sendAsUser };
