const messagesDiv = document.getElementById('messages');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const mainTitle = document.getElementById('mainTitle');
const themeToggle = document.getElementById('theme-toggle');
const userListContainer = document.getElementById('user-list-container');
const userList = document.getElementById('user-list');
const userCount = document.getElementById('user-count');
const typingIndicator = document.getElementById('typing-indicator');
const websocketUrlInput = document.getElementById('websocketUrlInput');
const connectButton = document.getElementById('connectButton');
const nicknameInput = document.getElementById('nicknameInput');
const recentConnectionsList = document.getElementById('recent-connections-list');
const recentConnectionsContainer = document.getElementById('recent-connections-container');

let ws;
let myNickname = nicknameInput.value;

// --- TYPING INDICATOR LOGIC ---
let typingTimer;
let isTyping = false;
const typingUsers = new Set();

function updateTypingIndicator() {
    if (typingUsers.size === 0) {
        typingIndicator.textContent = '\xa0';
    } else {
        const users = Array.from(typingUsers);
        typingIndicator.textContent = users.length === 1 ? `${users[0]} is typing...` : `${users.slice(0, 2).join(', ')} and others are typing...`;
    }
}

messageInput.addEventListener('input', () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        if (!isTyping) {
            isTyping = true;
            ws.send(JSON.stringify({ type: 'typing_start' }));
        }
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
            isTyping = false;
            ws.send(JSON.stringify({ type: 'typing_stop' }));
        }, 2000);
    }
});
// --- END TYPING INDICATOR ---

// --- THEME SWITCHER LOGIC ---
function setTheme(theme) {
    document.body.classList.toggle('dark-mode', theme === 'dark');
    themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
}

themeToggle.addEventListener('click', () => {
    const newTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    setTheme(newTheme);
});
// --- END THEME SWITCHER ---

// --- RECENT CONNECTIONS LOGIC ---
const MAX_RECENT_URLS = 3;

function saveRecentUrl(url) {
    let urls = JSON.parse(localStorage.getItem('recentUrls')) || [];
    urls = urls.filter(u => u !== url);
    urls.unshift(url);
    localStorage.setItem('recentUrls', JSON.stringify(urls.slice(0, MAX_RECENT_URLS)));
}

function checkUrlStatus(url, statusDot) {
    statusDot.className = 'status-dot pending';
    const checkWs = new WebSocket(url);
    let finished = false;
    const timeout = setTimeout(() => {
        if (finished) return;
        finished = true;
        statusDot.className = 'status-dot offline';
        checkWs.close();
    }, 4000);

    checkWs.onopen = () => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        statusDot.className = 'status-dot online';
        checkWs.close();
    };
    checkWs.onerror = () => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        statusDot.className = 'status-dot offline';
    };
}

function renderRecentConnections() {
    const urls = JSON.parse(localStorage.getItem('recentUrls')) || [];
    recentConnectionsList.innerHTML = '';
    if (urls.length === 0) {
        recentConnectionsContainer.style.display = 'none';
        return;
    }
    recentConnectionsContainer.style.display = 'block';
    urls.forEach(url => {
        const item = document.createElement('div');
        item.className = 'recent-connection-item';
        item.addEventListener('click', () => {
            websocketUrlInput.value = url;
        });
        const statusDot = document.createElement('div');
        const urlSpan = document.createElement('span');
        urlSpan.className = 'recent-url';
        urlSpan.textContent = url;
        item.appendChild(statusDot);
        item.appendChild(urlSpan);
        recentConnectionsList.appendChild(item);
        checkUrlStatus(url, statusDot);
    });
}
// --- END RECENT CONNECTIONS ---

// Initial Page Load Setup
(function () {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    const savedUrl = localStorage.getItem('websocketUrl');
    if (savedUrl) websocketUrlInput.value = savedUrl;
    const savedNickname = localStorage.getItem('nickname');
    if (savedNickname) nicknameInput.value = savedNickname;
    renderRecentConnections();
})();

function connectWebSocket() {
    const url = websocketUrlInput.value;
    myNickname = nicknameInput.value;
    if (!url || !myNickname) {
        appendMessage('System', 'Please enter a nickname and WebSocket URL.', 'received');
        return;
    }
    if (ws && ws.readyState === WebSocket.OPEN) ws.close();

    const connectionStatusDiv = document.getElementById('connectionStatus');
    const connectionSettingsDiv = document.querySelector('.connection-settings');
    const messageFormDiv = document.getElementById('messageForm');

    ws = new WebSocket(url.replace(/^http/, 'ws'));

    ws.onopen = () => {
        console.log('Connected to WebSocket server');
        connectionStatusDiv.textContent = 'Connected';
        connectionStatusDiv.style.color = 'green';
        [connectionSettingsDiv, mainTitle, recentConnectionsContainer].forEach(el => el.style.display = 'none');
        [messageFormDiv, userListContainer].forEach(el => el.style.display = 'flex');
        saveRecentUrl(url);
        localStorage.setItem('nickname', myNickname);
        ws.send(JSON.stringify({ type: 'set_nickname', nickname: myNickname }));
    };

    ws.onmessage = (event) => {
        try {
            const messageData = JSON.parse(event.data);
            switch (messageData.type) {
                case 'chat': appendMessage(messageData.sender, messageData.content, messageData.type, messageData.timestamp); break;
                case 'system': appendMessage(null, messageData.content, messageData.type, messageData.timestamp); break;
                case 'user_list': updateUserList(messageData.users); break;
                case 'user_typing': if (messageData.nickname !== myNickname) typingUsers.add(messageData.nickname); updateTypingIndicator(); break;
                case 'user_stopped_typing': if (messageData.nickname !== myNickname) typingUsers.delete(messageData.nickname); updateTypingIndicator(); break;
                default: appendMessage('Server', event.data, 'received');
            }
        } catch (e) {
            appendMessage('Server', event.data, 'received');
        }
    };

    const handleDisconnect = (error) => {
        console.log(error ? `WebSocket error: ${error}` : 'Disconnected from WebSocket server.');
        connectionStatusDiv.textContent = error ? 'Error' : 'Disconnected';
        connectionStatusDiv.style.color = error ? 'orange' : 'red';
        [connectionSettingsDiv, mainTitle, recentConnectionsContainer].forEach(el => el.style.display = 'block');
        [messageFormDiv, userListContainer].forEach(el => el.style.display = 'none');
        updateUserList([]);
        typingUsers.clear();
        updateTypingIndicator();
        renderRecentConnections();
        appendMessage('System', error ? 'WebSocket error occurred.' : 'Disconnected from server.', 'received');
    };

    ws.onclose = () => handleDisconnect(null);
    ws.onerror = (e) => handleDisconnect(e);
}

function updateUserList(users) {
    userCount.textContent = users.length;
    userList.innerHTML = '';
    users.forEach(user => {
        const li = document.createElement('li');
        li.textContent = user;
        userList.appendChild(li);
    });
}

function appendMessage(sender, content, type = 'chat', timestamp = null) {
    const messagesDiv = document.getElementById('messages');
    const messageElement = document.createElement('div');
    const date = timestamp ? new Date(timestamp) : new Date();
    const timestampStr = `<span class="timestamp">${date.toLocaleTimeString()}</span>`;

    if (type === 'system') {
        messageElement.classList.add('system-message');
        messageElement.innerHTML = `<em>${content}</em>${timestampStr}`;
    } else {
        messageElement.classList.add('message');
        messageElement.classList.toggle('my-message', sender === myNickname);
        messageElement.classList.toggle('other-message', sender !== myNickname);
        const messageContentDiv = document.createElement('div');
        messageContentDiv.classList.add('message-content');
        const messageText = document.createElement('span');
        messageText.innerHTML = `<strong>${sender}:</strong> `;
        messageText.appendChild(document.createTextNode(content));
        messageContentDiv.appendChild(messageText);
        messageContentDiv.innerHTML += timestampStr;
        messageElement.appendChild(messageContentDiv);
    }
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = messageInput.value;
    if (!message) return;
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'chat', content: message }));
        clearTimeout(typingTimer);
        isTyping = false;
        ws.send(JSON.stringify({ type: 'typing_stop' }));
        messageInput.value = '';
        messageInput.focus();
    } else {
        appendMessage('System', 'Not connected to server.', 'received');
    }
});

userListContainer.addEventListener('click', () => {
    userListContainer.classList.toggle('expanded');
});

connectButton.addEventListener('click', connectWebSocket);