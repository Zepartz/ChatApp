const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose(); // Import SQLite
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcrypt'); // Import bcrypt
const multer = require('multer'); // Import multer for file uploads
const fs = require('fs');

const app = express();

// Create the HTTP server
const server = http.createServer(app);

// Initialize Socket.io with the server
const io = socketIo(server);

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
const upload = multer({ storage });

// Ensure the uploads directory exists
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Middleware for parsing JSON
app.use(express.json());

// Middleware for session and passport
app.use(session({ secret: 'secret_key', resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

// Serve static files (HTML, CSS, JS) from 'public' folder
app.use(express.static('public'));

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Enable CORS
app.use(cors());

// SQLite setup
const db = new sqlite3.Database('./chatApp.sqlite', (err) => { // Updated file extension
    if (err) {
        console.error("Error opening database:", err);
    } else {
        console.log("SQLite database connected");
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            email TEXT NOT NULL,
            password TEXT NOT NULL,
            profilePicture TEXT
        )`, (err) => {
            if (err) {
                console.error("Error creating table:", err);
            } else {
                console.log("Users table created or already exists");
            }
        });
        db.run(`CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            senderId INTEGER NOT NULL,
            receiverId INTEGER NOT NULL,
            content TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (senderId) REFERENCES users(id),
            FOREIGN KEY (receiverId) REFERENCES users(id)
        )`, (err) => {
            if (err) {
                console.error("Error creating table:", err);
            } else {
                console.log("Messages table created or already exists");
            }
        });
    }
});

app.post('/auth/register', upload.single('profilePicture'), async (req, res) => {
    console.log('Received registration request:', req.body);  // Log received data

    const { username, email, password } = req.body;
    const profilePicture = req.file ? `/uploads/${req.file.filename}` : null;

    try {
        const hashedPassword = await bcrypt.hash(password, 10); // Hash the password

        db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ message: 'Database error', error: err });
            }

            if (row) {
                console.log('User already exists:', email);
                return res.status(400).json({ message: 'User already exists' });
            }

            const stmt = db.prepare('INSERT INTO users (username, email, password, profilePicture) VALUES (?, ?, ?, ?)');
            stmt.run([username, email, hashedPassword, profilePicture], function (err) {
                if (err) {
                    console.error('Error saving user:', err);
                    return res.status(500).json({ message: 'Error saving user', error: err });
                }
                const token = jwt.sign({ id: this.lastID }, 'secret_key', { expiresIn: '1h' });
                res.status(201).json({ token });
            });
            stmt.finalize();
        });
    } catch (err) {
        console.error('Error hashing password:', err);
        res.status(500).json({ message: 'Error hashing password', error: err });
    }
});

// Login Route (SQLite version)
app.post('/auth/login', (req, res) => {
    const { email, password } = req.body;

    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, row) => {
        if (err) {
            return res.status(500).json({ message: 'Database error' });
        }
        if (!row || !(await bcrypt.compare(password, row.password))) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: row.id }, 'secret_key', { expiresIn: '1h' });
        res.json({ token });
    });
});

// Fetch user profile
app.get('/auth/profile', (req, res) => {
    const token = req.headers['authorization'];
    if (!token) {
        return res.status(403).json({ message: 'No token provided' });
    }

    jwt.verify(token, 'secret_key', (err, decoded) => {
        if (err) {
            return res.status(500).json({ message: 'Failed to authenticate token' });
        }

        const userId = decoded.id;
        db.get('SELECT username, email, profilePicture FROM users WHERE id = ?', [userId], (err, row) => {
            if (err) {
                return res.status(500).json({ message: 'Database error' });
            }
            if (!row) {
                return res.status(404).json({ message: 'User not found' });
            }
            res.json(row);
        });
    });
});

// Fetch contacts
app.get('/auth/contacts', (req, res) => {
    const token = req.headers['authorization'];
    if (!token) {
        return res.status(403).json({ message: 'No token provided' });
    }

    jwt.verify(token, 'secret_key', (err, decoded) => {
        if (err) {
            return res.status(500).json({ message: 'Failed to authenticate token' });
        }

        db.all('SELECT id, username, profilePicture FROM users WHERE id != ?', [decoded.id], (err, rows) => {
            if (err) {
                return res.status(500).json({ message: 'Database error' });
            }
            res.json({ contacts: rows });
        });
    });
});

app.get('/', (req, res) => {
    const userName = req.query.username || 'Guest'; // Retrieve query parameter if exists
    console.log('User:', userName); // Log the username from query parameters
    res.sendFile(path.join(__dirname, 'public', 'login.html')); // Serve login.html
});

// Handle chat messages
io.on('connection', (socket) => {
    const token = socket.handshake.query.token;
    if (!token) {
        console.log('A user connected without a token');
        return;
    }

    jwt.verify(token, 'secret_key', (err, decoded) => {
        if (err) {
            console.error('Failed to authenticate token');
            return;
        }

        const userId = decoded.id;
        db.get('SELECT username, profilePicture FROM users WHERE id = ?', [userId], (err, row) => {
            if (err) {
                console.error('Database error:', err);
                return;
            }

            if (!row) {
                console.error('User not found');
                return;
            }

            const username = row.username;
            const profilePicture = row.profilePicture;
            console.log(`${username} connected`);

            // Join the user to their own room
            socket.join(userId);

            // Handle incoming chat messages
            socket.on('chat message', (msg) => {
                console.log('Received message:', msg); // Debug log

                const message = {
                    content: msg.content,
                    sender: username,
                    profilePicture: profilePicture,
                    timestamp: new Date()
                };

                console.log('Broadcasting message:', message); // Debug log

                // Save message to database
                const stmt = db.prepare('INSERT INTO messages (senderId, receiverId, content) VALUES (?, ?, ?)');
                stmt.run([userId, msg.contactId, msg.content], function (err) {
                    if (err) {
                        console.error('Error saving message:', err);
                        return;
                    }
                    io.to(msg.contactId).emit('chat message', message);
                    io.to(userId).emit('chat message', message); // Emit to sender as well
                });
                stmt.finalize();
            });

            // Handle typing event
            socket.on('typing', (data) => {
                socket.to(data.contactId).emit('typing', { username });
            });

            // Load chat history
            socket.on('load chat', (data) => {
                db.all('SELECT messages.content, messages.timestamp, users.username, users.profilePicture FROM messages JOIN users ON messages.senderId = users.id WHERE (messages.senderId = ? AND messages.receiverId = ?) OR (messages.senderId = ? AND messages.receiverId = ?) ORDER BY messages.timestamp ASC', [userId, data.contactId, data.contactId, userId], (err, rows) => {
                    if (err) {
                        console.error('Error loading chat history:', err);
                        return;
                    }
                    socket.emit('chat history', rows);
                });
            });

            socket.on('disconnect', () => {
                console.log(`${username} disconnected`);
            });
        });
    });
});

// Start the server on port 3005
server.listen(3005, () => {
    console.log('Server running on http://localhost:3005');
});
