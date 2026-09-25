// Google OAuth login, restricted to @flame.edu.in accounts.
//
// Any real @flame.edu.in Google account can log in - being present in
// biometric.json's sample roster is NOT required to sign in. That file is
// currently just 100 sample students for demo/testing purposes, not the
// full real student body. A student outside that sample set can still log
// in and use the app; they simply won't have attendance or bill data yet,
// which the app already handles gracefully downstream (flagged as "no
// biometric record" rather than crashing or being blocked at login).
//
// Session shape once logged in:
//   req.session.user = {
//     email: "kashvi.saharan@flame.edu.in",
//     name: "Kashvi Saharan",   // from Google profile
//     accessToken: "..."        // used later for sending Gmail as this user
//   }

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const ALLOWED_DOMAIN = 'flame.edu.in';

function configurePassport(biometric) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
    scope: ['profile', 'email', 'https://www.googleapis.com/auth/gmail.send']
  }, (accessToken, refreshToken, profile, done) => {
    const email = profile.emails?.[0]?.value?.toLowerCase();

    if (!email || !email.endsWith('@' + ALLOWED_DOMAIN)) {
      return done(null, false, { message: 'Only @flame.edu.in accounts are allowed.' });
    }

    // No roster-membership check here on purpose - any real flame.edu.in
    // account is allowed to sign in. Downstream routes already handle a
    // student who isn't in biometric.json gracefully (flagged, not crashed).
    const user = {
      email,
      name: profile.displayName || email.split('@')[0],
      accessToken
    };
    return done(null, user);
  }));

  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((obj, done) => done(null, obj));
}

// Route guard: Google login (with the domain check above) is sufficient.
function requireFullLogin(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ error: 'Not logged in' });
}

module.exports = { configurePassport, requireFullLogin, ALLOWED_DOMAIN };
