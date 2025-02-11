const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const User = require('./models/User');  // Ensure you require the User model correctly

// Serialize and Deserialize user
passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(async function(id, done) {
    const user = await User.findById(id);
    done(null, user);
});

// Local strategy for login (authenticating via email/password)
passport.use(
    new LocalStrategy(
        { usernameField: 'email' },
        async function(email, password, done) {
            const user = await User.findOne({ email });
            if (!user) return done(null, false, { message: 'Invalid email or password' });

            const match = await user.matchPassword(password);
            if (!match) return done(null, false, { message: 'Invalid email or password' });

            return done(null, user);
        }
    )
);
