const messagesDiv = document.getElementById('messages');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const mainTitle = document.getElementById('mainTitle');
const themeToggle = document.getElementById('theme-toggle');
const userListContainer = document.getElementById('user-list-container');
const userList = document.getElementById('user-list');
const userCount = document.getElementById('user-count');

// WebSocket 서버 주소를 여기에 입력하세요.
const websocketUrlInput = document.getElementById('websocketUrlInput');
const connectButton = document.getElementById('connectButton');
const nicknameInput = document.getElementById('nicknameInput');

let ws;

// --- THEME SWITCHER LOGIC ---
function setTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
        themeToggle.textContent = '☀️';
    } else {
        document.body.classList.remove('dark-mode');
        themeToggle.textContent = '🌙';
    }
}

themeToggle.addEventListener('click', () => {
    const currentTheme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', newTheme);
    setTheme(newTheme);
});

// Apply saved theme on load
(function () {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
})();
// --- END THEME SWITCHER ---


// Load URL and Nickname from localStorage or set a default
const savedUrl = localStorage.getItem('websocketUrl');
if (savedUrl) {
    websocketUrlInput.value = savedUrl;
}

const savedNickname = localStorage.getItem('nickname');
if (savedNickname) {
    nicknameInput.value = savedNickname;
}

function connectWebSocket() {
    const url = websocketUrlInput.value;
    const nickname = nicknameInput.value;

    if (!url) {
        appendMessage('System', 'Please enter a WebSocket URL.', 'received');
        return;
    }
    if (!nickname) {
        appendMessage('System', 'Please enter a nickname.', 'received');
        return;
    }

    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
    }

    const connectionStatusDiv = document.getElementById('connectionStatus');
    const connectionSettingsDiv = document.querySelector('.connection-settings');
    const messageFormDiv = document.getElementById('messageForm');

    ws = new WebSocket(url.replace('http://', 'ws://').replace('https://', 'wss://'));

    ws.onopen = () => {
        console.log('Connected to WebSocket server');
        connectionStatusDiv.textContent = 'Connected';
        connectionStatusDiv.style.color = 'green';
        connectionSettingsDiv.style.display = 'none';
        messageFormDiv.style.display = 'flex';
        mainTitle.style.display = 'none';
        userListContainer.style.display = 'block'; // Show user list
        appendMessage('System', `Connected to ${url}` , 'received');
        localStorage.setItem('websocketUrl', url);
        localStorage.setItem('nickname', nickname);

        ws.send(JSON.stringify({
            type: 'set_nickname',
            nickname: nickname
        }));
    };

    ws.onmessage = (event) => {
        console.log('Message from server:', event.data);
        try {
            const messageData = JSON.parse(event.data);
            
            if (messageData.type === 'chat') {
                appendMessage(messageData.sender, messageData.content, messageData.type, messageData.timestamp);
            } else if (messageData.type === 'system') {
                if (messageData.content.startsWith('환영합니다,')) {
                    myNickname = messageData.content.split(',')[1].split('님!')[0].trim();
                }
                appendMessage(null, messageData.content, messageData.type, messageData.timestamp);
            } else if (messageData.type === 'user_list') {
                updateUserList(messageData.users);
            } else { 
                appendMessage('Server', event.data, 'received');
            }
        } catch (e) {
            appendMessage('Server', event.data, 'received');
        }
    };

    ws.onclose = () => {
        console.log('Disconnected from WebSocket server.');
        connectionStatusDiv.textContent = 'Disconnected';
        connectionStatusDiv.style.color = 'red';
        connectionSettingsDiv.style.display = 'flex';
        messageFormDiv.style.display = 'none';
        mainTitle.style.display = 'block';
        userListContainer.style.display = 'none'; // Hide user list
        updateUserList([]); // Clear user list
        appendMessage('System', 'Disconnected from server.', 'received');
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        connectionStatusDiv.textContent = 'Error';
        connectionStatusDiv.style.color = 'orange';
        connectionSettingsDiv.style.display = 'flex';
        messageFormDiv.style.display = 'none';
        mainTitle.style.display = 'block';
        userListContainer.style.display = 'none'; // Hide user list
        updateUserList([]); // Clear user list
        appendMessage('System', 'WebSocket error occurred. Check console for details.', 'received');
        ws.close(); 
    };
}

function updateUserList(users) {
    userCount.textContent = users.length;
    userList.innerHTML = ''; // Clear current list
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
    } else { // 'chat' type
        messageElement.classList.add('message');
        if (sender === myNickname) {
            messageElement.classList.add('my-message');
        } else {
            messageElement.classList.add('other-message');
        }
        
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
    const currentNickname = nicknameInput.value;

    if (message.startsWith('/nick ')) {
        const newNickname = message.substring(6).trim();
        if (newNickname) {
            nicknameInput.value = newNickname;
            localStorage.setItem('nickname', newNickname);
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'set_nickname',
                    nickname: newNickname
                }));
                appendMessage('System', `닉네임을 ${newNickname}으로 변경했습니다.`, 'sent');
            } else {
                appendMessage('System', '닉네임이 로컬에서 변경되었지만, 서버에 연결되어 있지 않습니다.', 'received');
            }
        } else {
            appendMessage('System', '사용할 닉네임을 입력해주세요. 예: /nick 새로운닉네임', 'received');
        }
        messageInput.value = '';
        messageInput.focus();
        return;
    }

    if (message && ws && ws.readyState === WebSocket.OPEN) {
        const messageToSend = JSON.stringify({
            type: 'chat',
            sender: currentNickname,
            content: message
        });
        ws.send(messageToSend);
        messageInput.value = '';
        messageInput.focus();
    } else if (!ws || ws.readyState !== WebSocket.OPEN) {
        appendMessage('System', 'Not connected to server. Please connect first.', 'received');
    }
});

connectButton.addEventListener('click', connectWebSocket);


// Global variable to store my nickname
let myNickname = nicknameInput.value;