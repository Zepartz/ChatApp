document.addEventListener('DOMContentLoaded', () => {
    // Handle Login Form Submission
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            const response = await fetch('http://localhost:3005/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();
            if (data.token) {
                // Save the token to localStorage
                localStorage.setItem('authToken', data.token);
                console.log('Login successful');
                window.location.href = '/';  // Redirect to main page
            } else {
                console.error('Login failed');
            }
        });
    }

    // Handle Registration Form Submission
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const username = document.getElementById('register-username').value;
            const email = document.getElementById('register-email').value;
            const password = document.getElementById('register-password').value;
            const profilePicture = document.getElementById('register-profile-picture').files[0];

            const formData = new FormData();
            formData.append('username', username);
            formData.append('email', email);
            formData.append('password', password);
            if (profilePicture) {
                formData.append('profilePicture', profilePicture);
            }

            const response = await fetch('http://localhost:3005/auth/register', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            if (data.token) {
                localStorage.setItem('authToken', data.token);
                console.log('Registration successful');
                window.location.href = '/';  // Redirect to main page
            } else {
                console.error('Registration failed');
            }
        });
    }

    // Ensure the user is logged in before accessing the chat
    const token = localStorage.getItem('authToken');
    if (!token && window.location.pathname === '/') {
        console.log('User not logged in');
        window.location.href = '/login.html';  // Redirect to login page if no token is found
    }

    // Chat Logic (Sending and Receiving Messages)
    const socket = io('http://localhost:3005', {
        query: { token }
    });  // Connect to the Socket.io server with token

    // Handle authentication error
    socket.on('auth error', (data) => {
        console.error(data.message);
        localStorage.removeItem('authToken');  // Remove invalid token
        window.location.href = '/login.html';  // Redirect to login page
    });

    // Get elements
    const form = document.getElementById('chat-form');
    const messageInput = document.getElementById('message');
    const messagesContainer = document.getElementById('messages');
    const typingIndicator = document.getElementById('typing-indicator');
    const sendButton = document.getElementById('send-button');
    const profileUsername = document.getElementById('profile-username');
    const profilePicture = document.getElementById('profile-picture');
    const contactsList = document.getElementById('contacts-list');
    const currentChatUsername = document.getElementById('current-chat-username');
    const currentChatPicture = document.getElementById('current-chat-picture');
    const rightSidebarProfileUsername = document.getElementById('right-sidebar-profile-username');
    const rightSidebarProfilePicture = document.getElementById('right-sidebar-profile-picture');

    let currentContactId = null;

    // Fetch and display user profile
    fetch('http://localhost:3005/auth/profile', {
        headers: { 'Authorization': token }
    })
    .then(response => response.json())
    .then(data => {
        profileUsername.textContent = data.username;
        profilePicture.src = data.profilePicture || 'https://creatie.ai/ai/api/search-image?query=A professional headshot&width=40&height=40';
    });

    // Fetch and display contacts
    fetch('http://localhost:3005/auth/contacts', {
        headers: { 'Authorization': token }
    })
    .then(response => response.json())
    .then(data => {
        data.contacts.forEach(contact => {
            const contactElement = document.createElement('div');
            contactElement.className = 'flex items-center p-3 bg-gray-50 rounded-lg cursor-pointer';
            contactElement.innerHTML = `
                <img src="${contact.profilePicture || 'https://creatie.ai/ai/api/search-image?query=A professional headshot&width=40&height=40'}"
                    class="w-10 h-10 rounded-full" alt="Contact">
                <div class="ml-3 flex-1">
                    <h4 class="font-medium">${contact.username}</h4>
                    <span class="text-xs text-gray-500">Online</span>
                </div>
            `;
            contactElement.addEventListener('click', () => {
                currentChatUsername.textContent = contact.username;
                currentChatPicture.src = contact.profilePicture || 'https://creatie.ai/ai/api/search-image?query=A professional headshot&width=40&height=40';
                rightSidebarProfileUsername.textContent = contact.username;
                rightSidebarProfilePicture.src = contact.profilePicture || 'https://creatie.ai/ai/api/search-image?query=A professional headshot&width=80&height=80';
                currentContactId = contact.id;
                // Clear messages and load chat history with this contact
                messagesContainer.innerHTML = '';
                socket.emit('load chat', { contactId: contact.id });
            });
            contactsList.appendChild(contactElement);
        });
    });

    // Listen for incoming messages from the server
    socket.on('chat message', (msg) => {
        console.log('Received message:', msg); // Debug log

        const li = document.createElement('li');
        li.className = 'flex items-start space-x-3';
        li.innerHTML = `
            <img src="${msg.profilePicture || 'https://creatie.ai/ai/api/search-image?query=A professional headshot&width=40&height=40'}"
                class="w-8 h-8 rounded-full" alt="Profile">
            <div>
                <div class="bg-gray-100 rounded-lg p-3">
                    <strong>${msg.sender}</strong>
                    <p>${msg.content}</p>
                </div>
                <span class="text-xs text-gray-500">${new Date(msg.timestamp).toLocaleTimeString()}</span>
            </div>
        `;
        messagesContainer.appendChild(li);
        messagesContainer.scrollTop = messagesContainer.scrollHeight; // Scroll to the bottom
    });

    // Listen for typing events from the server
    socket.on('typing', (data) => {
        typingIndicator.textContent = `${data.username} is typing...`;
        setTimeout(() => {
            typingIndicator.textContent = '';
        }, 3000); // Clear the typing indicator after 3 seconds
    });

    // Emit typing event when the user starts typing
    messageInput.addEventListener('input', () => {
        socket.emit('typing', { contactId: currentContactId });
    });

    // Submit the form and send a message
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const message = messageInput.value;

            console.log('Sending message:', message); // Debug log

            // Emit the message to the server
            if (message) {
                socket.emit('chat message', { content: message, contactId: currentContactId });
                messageInput.value = '';  // Clear input field after sending
            }
        });
    }

    // Handle send button click
    if (sendButton) {
        sendButton.addEventListener('click', (e) => {
            e.preventDefault();
            const message = messageInput.value;

            console.log('Sending message:', message); // Debug log

            // Emit the message to the server
            if (message) {
                socket.emit('chat message', { content: message, contactId: currentContactId });
                messageInput.value = '';  // Clear input field after sending
            }
        });
    }

    // Allow sending message by pressing Enter
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendButton.click();
        }
    });

    // Load chat history
    socket.on('chat history', (messages) => {
        messages.forEach(msg => {
            const li = document.createElement('li');
            li.className = 'flex items-start space-x-3';
            li.innerHTML = `
                <img src="${msg.profilePicture || 'https://creatie.ai/ai/api/search-image?query=A professional headshot&width=40&height=40'}"
                    class="w-8 h-8 rounded-full" alt="Profile">
                <div>
                    <div class="bg-gray-100 rounded-lg p-3">
                        <strong>${msg.username}</strong>
                        <p>${msg.content}</p>
                    </div>
                    <span class="text-xs text-gray-500">${new Date(msg.timestamp).toLocaleTimeString()}</span>
                </div>
            `;
            messagesContainer.appendChild(li);
        });
        messagesContainer.scrollTop = messagesContainer.scrollHeight; // Scroll to the bottom
    });
});