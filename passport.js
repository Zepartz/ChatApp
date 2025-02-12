const passport = require('passport');
const { ExtractJwt, Strategy: JwtStrategy } = require('passport-jwt');
const User = require('./models/User'); // Your User model
const jwtSecret = 'secret_key';  // Make sure to store this securely

passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromHeader('authorization'),
      secretOrKey: jwtSecret,
    },
    async (payload, done) => {
      try {
        const user = await User.findById(payload.id);
        if (!user) {
          return done(null, false);
        }
        return done(null, user);
      } catch (error) {
        done(error, false);
      }
    }
  )
);

module.exports = passport;
