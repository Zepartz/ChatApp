const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const Message = require('./models/Message');
const User = require('./models/User');
const authRoutes = require('./routes/auth');  // Import the auth routes

const app = express();

// Create the HTTP server
const server = http.createServer(app);

// Initialize Socket.io with the server
const io = socketIo(server);

// Middleware for parsing JSON
app.use(express.json());

// Middleware for session and passport
app.use(session({ secret: 'secret_key', resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

// Use the auth routes for handling login/register
app.use('/auth', authRoutes);

// Serve static files (HTML, CSS, JS) from 'public' folder
app.use(express.static('public'));

// Middleware to ensure proper authentication with JWT for Socket.io
io.use((socket, next) => {
    const token = socket.handshake.query.token; // Get the token from the query string

    if (!token) {
        return next(new Error('Authentication error: No token provided'));
    }

    // Verify token
    jwt.verify(token, 'secret_key', (err, decoded) => {
        if (err) {
            return next(new Error('Authentication error: Invalid token'));
        }

        socket.user = decoded; // Store user info in the socket
        next(); // Proceed with the connection
    });
});

// Socket.io connection logic
io.on('connection', (socket) => {
    console.log('User connected');

    // Load previous messages when a user connects
    socket.on('load messages', async () => {
        const messages = await Message.find().populate('sender', 'username');
        socket.emit('load messages', messages); // Send messages back to the client
    });

    // Handle sending a message
    socket.on('chat message', async (msg) => {
        if (!socket.user) {
            return socket.emit('error', 'User is not authenticated');
        }

        const message = new Message({ content: msg, sender: socket.user.id });
        await message.save();

        // Broadcast the message to all users
        io.emit('chat message', { content: msg, sender: socket.user.username });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// Start the server on port 3005
server.listen(3005, () => {
    console.log('Server running on http://localhost:3005');
});
