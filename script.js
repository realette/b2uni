const messagesDiv = document.getElementById('messages');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const mainTitle = document.getElementById('mainTitle');
const themeToggle = document.getElementById('theme-toggle');
const notificationToggle = document.getElementById('notification-toggle');
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

// --- NOTIFICATION LOGIC ---
function updateNotificationButton() {
    if (!('Notification' in window)) {
        notificationToggle.style.display = 'none';
        return;
    }
    if (Notification.permission === 'granted') {
        notificationToggle.classList.add('enabled');
    } else {
        notificationToggle.classList.remove('enabled');
    }
}

function showNotification(title, body) {
    if (!('Notification' in window) || Notification.permission !== 'granted' || document.hasFocus()) {
        return;
    }
    new Notification(title, { body: body, icon: './favicon.ico' });
}

notificationToggle.addEventListener('click', () => {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
            updateNotificationButton();
        });
    }
});
// --- END NOTIFICATION LOGIC ---

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
    const timeout = setTimeout(() => { if (!finished) { finished = true; statusDot.className = 'status-dot offline'; checkWs.close(); } }, 4000);
    checkWs.onopen = () => { if (!finished) { finished = true; clearTimeout(timeout); statusDot.className = 'status-dot online'; checkWs.close(); } };
    checkWs.onerror = () => { if (!finished) { finished = true; clearTimeout(timeout); statusDot.className = 'status-dot offline'; } };
}

function renderRecentConnections() {
    const urls = JSON.parse(localStorage.getItem('recentUrls')) || [];
    recentConnectionsList.innerHTML = '';
    recentConnectionsContainer.style.display = urls.length > 0 ? 'block' : 'none';
    urls.forEach(url => {
        const item = document.createElement('div');
        item.className = 'recent-connection-item';
        item.addEventListener('click', () => { websocketUrlInput.value = url; });
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
    setTheme(localStorage.getItem('theme') || 'light');
    websocketUrlInput.value = localStorage.getItem('websocketUrl') || '';
    nicknameInput.value = localStorage.getItem('nickname') || `Guest${Math.floor(Math.random() * 1000)}`;
    myNickname = nicknameInput.value;
    renderRecentConnections();
    updateNotificationButton();
})();

function connectWebSocket() {
    const url = websocketUrlInput.value;
    myNickname = nicknameInput.value;
    if (!url || !myNickname) { appendMessage('System', 'Please enter a nickname and WebSocket URL.'); return; }
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
                case 'chat':
                    if (messageData.mentions && messageData.mentions.includes(myNickname)) {
                        showNotification(`Mention from ${messageData.sender}`, messageData.content);
                    }
                    appendMessage(messageData.sender, messageData.content, messageData.type, messageData.timestamp, messageData.mentions);
                    break;
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
        [connectionSettingsDiv, mainTitle].forEach(el => el.style.display = 'block');
        [messageFormDiv, userListContainer].forEach(el => el.style.display = 'none');
        updateUserList([]);
        typingUsers.clear();
        updateTypingIndicator();
        renderRecentConnections();
        appendMessage('System', error ? 'WebSocket error occurred.' : 'Disconnected from server.');
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

function appendMessage(sender, content, type = 'chat', timestamp = null, mentions = []) {
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
        
        // Sanitize content before processing for mentions
        const sanitizedContent = document.createTextNode(content).textContent;
        const highlightedContent = sanitizedContent.replace(/@(\w+)/g, (match, nickname) => {
            const isSelf = nickname === myNickname;
            return `<span class="mention ${isSelf ? 'self-mention' : ''}">${match}</span>`;
        });

        messageText.innerHTML = `<strong>${sender}:</strong> ${highlightedContent}`;
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
    if (message.startsWith('/')) { handleSlashCommand(message); return; }
    if (ws && ws.readyState === WebSocket.OPEN) {
        const mentions = [...message.matchAll(/@(\w+)/g)].map(match => match[1]);
        ws.send(JSON.stringify({ type: 'chat', content: message, mentions: mentions }));
        clearTimeout(typingTimer);
        isTyping = false;
        ws.send(JSON.stringify({ type: 'typing_stop' }));
        messageInput.value = '';
        messageInput.focus();
    } else {
        appendMessage('System', 'Not connected to server.');
    }
});

function handleSlashCommand(message) {
    const parts = message.split(' ');
    const command = parts[0];
    const arg = parts.slice(1).join(' ');
    switch (command) {
        case '/nick':
            if (arg) {
                myNickname = arg;
                nicknameInput.value = arg;
                localStorage.setItem('nickname', arg);
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'set_nickname', nickname: arg }));
                }
                appendMessage('System', `Nickname changed to ${arg}.`);
            } else {
                appendMessage('System', 'Usage: /nick [new_nickname]');
            }
            break;
        case '/help':
            appendMessage('System', 'Available commands: /nick [name], /help');
            break;
        default:
            appendMessage('System', `Unknown command: ${command}`);
            break;
    }
    messageInput.value = '';
    messageInput.focus();
}

userListContainer.addEventListener('click', () => {
    userListContainer.classList.toggle('expanded');
});

connectButton.addEventListener('click', connectWebSocket);