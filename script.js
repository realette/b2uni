const messagesDiv = document.getElementById('messages');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');

// WebSocket 서버 주소를 여기에 입력하세요.
// 예: ws://localhost:8765 또는 wss://your-server.com/ws
const websocketUrlInput = document.getElementById('websocketUrlInput');
const connectButton = document.getElementById('connectButton');
const nicknameInput = document.getElementById('nicknameInput');

let ws;

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

    // Close existing connection if any
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
    }

    
const connectionStatusDiv = document.getElementById('connectionStatus');
const connectionSettingsDiv = document.querySelector('.connection-settings'); // Use querySelector for class
const messageFormDiv = document.getElementById('messageForm');

    ws = new WebSocket(url.replace('http://', 'ws://').replace('https://', 'wss://'));

    ws.onopen = () => {
        console.log('Connected to WebSocket server');
        connectionStatusDiv.textContent = 'Connected';
        connectionStatusDiv.style.color = 'green';
        connectionSettingsDiv.style.display = 'none'; // Hide connection settings
        messageFormDiv.style.display = 'flex'; // Show message form
        appendMessage('System', `Connected to ${url}` , 'received');
        localStorage.setItem('websocketUrl', url); // Save URL to localStorage
        localStorage.setItem('nickname', nickname); // Save nickname to localStorage

        // Send initial nickname to server
        ws.send(JSON.stringify({
            type: 'set_nickname',
            nickname: nickname
        }));
    };

    ws.onmessage = (event) => {
        console.log('Message from server:', event.data);
        try {
            const messageData = JSON.parse(event.data);
            console.log('Parsed messageData:', messageData); // <--- ADD THIS LOG

            if (messageData.type === 'chat') {
                appendMessage(messageData.sender, messageData.content, messageData.type, messageData.timestamp);
            } else if (messageData.type === 'system') {
                if (messageData.content.startsWith('환영합니다,')) {
                    myNickname = messageData.content.split(',')[1].split('님!')[0].trim();
                    console.log('My nickname is:', myNickname);
                }
                appendMessage(null, messageData.content, messageData.type, messageData.timestamp);
            } else { // Fallback for unknown types
                appendMessage('Server', event.data, 'received');
            }
        } catch (e) {
            // If not JSON, display as plain text
            appendMessage('Server', event.data, 'received');
        }
    };

    ws.onclose = () => {
        console.log('Disconnected from WebSocket server.');
        connectionStatusDiv.textContent = 'Disconnected';
        connectionStatusDiv.style.color = 'red';
        connectionSettingsDiv.style.display = 'flex'; // Show connection settings
        messageFormDiv.style.display = 'none'; // Hide message form
        appendMessage('System', 'Disconnected from server.', 'received');
        // No automatic reconnect here, user needs to click connect again
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        connectionStatusDiv.textContent = 'Error';
        connectionStatusDiv.style.color = 'orange';
        connectionSettingsDiv.style.display = 'flex'; // Show connection settings
        messageFormDiv.style.display = 'none'; // Hide message form
        appendMessage('System', 'WebSocket error occurred. Check console for details.', 'received');
        ws.close(); 
    };
}

function appendMessage(sender, content, type = 'chat', timestamp = null) {
    const messagesDiv = document.getElementById('messages');
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');

    let timestampStr = '';
    if (timestamp) {
        const date = new Date(timestamp);
        timestampStr = `<span class="timestamp">${date.toLocaleTimeString()}</span>`;
    }

    let messageHtml = ''; // Declare a variable to hold the HTML string

    if (type === 'chat') {
        messageHtml = `<strong>${sender}:</strong> ${content} ${timestampStr}`;
        if (sender === myNickname) {
            messageElement.classList.add('my-message');
        } else {
            messageElement.classList.add('other-message'); // Optional: for explicit styling of others' messages
        }
    } else if (type === 'system') {
        messageElement.classList.add('system-message');
        messageHtml = `<em>${content}</em> ${timestampStr}`;
    }
    messageElement.innerHTML = messageHtml; // Assign the HTML string
    console.log('Appending message:', { sender, content, type, timestamp, messageHtml, innerHTML: messageElement.innerHTML }); // <--- ADD THIS LOG
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight; // Auto-scroll to bottom
}

messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = messageInput.value;
    const currentNickname = nicknameInput.value; // Get current nickname

    if (message.startsWith('/nick ')) {
        const newNickname = message.substring(6).trim();
        if (newNickname) {
            nicknameInput.value = newNickname;
            localStorage.setItem('nickname', newNickname); // Save new nickname
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
        return;
    }

    if (message && ws && ws.readyState === WebSocket.OPEN) {
        const messageToSend = JSON.stringify({
            type: 'chat',
            sender: currentNickname, // Include sender nickname
            content: message
        });
        ws.send(messageToSend);
        messageInput.value = '';
    } else if (!ws || ws.readyState !== WebSocket.OPEN) {
        appendMessage('System', 'Not connected to server. Please connect first.', 'received');
    }
});

connectButton.addEventListener('click', connectWebSocket);
