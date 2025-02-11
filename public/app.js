const socket = io('http://localhost:3005');  // Connect to the Socket.io server

// Get elements
const form = document.getElementById('chat-form');
const messageInput = document.getElementById('message');
const messages = document.getElementById('messages');

// Listen for incoming messages from the server
socket.on('chat message', (msg) => {
    const li = document.createElement('li');
    li.textContent = `${msg.sender}: ${msg.content}`;
    messages.appendChild(li);
});

// Submit the form and send a message
form.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = messageInput.value;

    // Emit the message to the server
    if (message) {
        socket.emit('chat message', message);
        messageInput.value = '';  // Clear input field after sending
    }
});

// Load previous messages when the user connects
socket.emit('load messages');
