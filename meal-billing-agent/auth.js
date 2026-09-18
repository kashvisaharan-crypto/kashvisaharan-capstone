// Google OAuth login, restricted to @flame.edu.in accounts.
//
// Since each student's Google email is guaranteed unique, and
// biometric.json is keyed by that same email, a successful Google login
// that matches an entry in the roster is enough on its own - no separate
// "confirm your Student ID" step is needed. The email IS the unique
// identifier; Student ID is just a display field we look up afterward.
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

    const student = biometric[email];
    if (!student) {
      return done(null, false, { message: 'This email is not in the student roster. Contact the hostel office if this is a mistake.' });
    }

    const user = {
      email,
      name: profile.displayName || student.name,
      accessToken
    };
    return done(null, user);
  }));

  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((obj, done) => done(null, obj));
}

// Route guard: Google login + roster match is sufficient on its own now.
function requireFullLogin(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ error: 'Not logged in' });
}

module.exports = { configurePassport, requireFullLogin, ALLOWED_DOMAIN };
