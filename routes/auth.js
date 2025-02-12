const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const router = express.Router();

router.post('/register.html', async (req, res) => {
    const { username, email, password } = req.body;

    console.log('Received register request:', { username, email, password });  // Log request data

    try {
        let user = await User.findOne({ email });
        if (user) {
            console.log('User already exists:', email);
            return res.status(400).json({ message: 'User already exists' });
        }

        user = new User({ username, email, password });

        // Hash password before saving
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        await user.save();
        console.log('User registered:', { id: user._id, username, email });

        const token = jwt.sign({ id: user._id }, 'secret_key', { expiresIn: '1h' });
        res.status(201).json({ token });
    } catch (err) {
        console.error('Error during registration:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Login Route (using Passport.js)
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    console.log('Login attempt:', email);

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        console.log('Login successful for:', user.username);

        const token = jwt.sign({ id: user._id }, 'secret_key', { expiresIn: '1h' });

        res.json({ token });
    } catch (err) {
        console.error('Error logging in:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Protect route example with Passport.js
router.get('/protected', passport.authenticate('jwt', { session: false }), (req, res) => {
    res.json({ message: 'Protected route accessed' });
});

module.exports = router;
