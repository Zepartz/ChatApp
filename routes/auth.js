const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const router = express.Router();

// Register route
router.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    try {
        // Check if user already exists
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Create a new user
        user = new User({ username, email, password });

        // Save user to the database
        await user.save();

        // Generate a JWT token
        const token = jwt.sign({ id: user._id }, 'secret_key', { expiresIn: '1h' });

        res.status(201).json({ token });  // Send the token back to the client
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Login route
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Compare the entered password with the stored hashed password
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Generate a JWT token
        const token = jwt.sign({ id: user._id }, 'secret_key', { expiresIn: '1h' });

        res.json({ token });  // Send the token back to the client
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
