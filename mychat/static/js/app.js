async function ensureValidToken() {
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    const exp = Number(localStorage.getItem('accessExp')) * 1000;
    if (!accessToken || !refreshToken || !exp) {
        window.location.href = '/auth/';
        return false;
    }

    const now = Date.now();
    if (now > exp - 30 * 1000) {
        try {
            const res = await fetch('/api/auth/token/refresh/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh })
            });
            if (!res.ok) throw new Error('Refresh failed');
            const data = await res.json();
            const newExp = JSON.parse(atob(data.access.split('.')[1])).exp;
            localStorage.setItem('accessToken', data.access);
            localStorage.setItem('accessExp', newExp);
            return true;
        } catch (err) {
            console.warn('Cannot refresh token:', err);
            localStorage.clear();
            window.location.href = '/auth/';
            return false;
        }
    }
    return true;
}

async function apiFetch(url, options = {}) {
    await ensureValidToken();
    const tokenToSend = localStorage.getItem('accessToken');
    options.headers = {
        ...(options.headers || {}),
        'Authorization': 'Bearer ' + tokenToSend,
    };
    return fetch(url, options);
}

(async function init() {
    const ok = await ensureValidToken();
    if (!ok) return;
    await fetchMemberships();
})();

async function fetchMemberships() {
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) return;

    try {
        const response = await fetch('/api/chat/memberships/', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
                window.location.reload();
            }
            throw new Error('Ошибка при получении списка комнат');
        }

        const memberships = await response.json();
        renderChatList(memberships);
    } catch (error) {
        console.error(error);
    }
}

function renderChatList(memberships) {
    const roomListEl = document.getElementById('chat-list');
    roomListEl.innerHTML = '';

    memberships.forEach(membership => {
        const li = document.createElement('li');
        li.textContent = membership.room.name;
        li.setAttribute('data-chat-id', membership.room.id);
        li.style.cursor = 'pointer';
        li.addEventListener('click', () => {
            selectChat(membership.room.id, membership.room.name);
        });
        roomListEl.append(li);
    });
}

document.getElementById('create-chat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const chatName = document.getElementById('new-chat-name').value.trim();
    const errorEl = document.getElementById('create-chat-error');
    errorEl.style.display = 'none';
    if (!chatName) return;

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    try {
        const createRes = await fetch('/api/chat/rooms/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ name: chatName })
        });
        if (createRes.status === 400) {
            const errData = await createRes.json();
            throw new Error(errData.name ? JSON.stringify(errData.name) : 'Ошибка создания');
        }
        if (!createRes.ok) throw new Error('Ошибка создания комнаты');

        const newChat = await createRes.json();

        await fetchMemberships();

        selectChat(newChat.id, newChat);

        document.getElementById('new-chat-name').value = '';
        errorEl.style.display = 'none';
    } catch (err) {
        errorEl.textContent = err.message;
        errorEl.style.display = 'block';
    }
});

let ws = null;
let currentChatId = null;
let currentChatName = null;
let currentNick = null;
let earliestTimestamp = null;


function selectChat(chatId, chat) {
    document.querySelectorAll('#chat-list li').forEach(li => li.classList.remove('active'));
    const li = document.querySelector(`#chat-list li[data-chat-id="${chatId}"]`);
    li.classList.add('active');

    document.getElementById('chat-placeholder').classList.add('hidden');
    document.getElementById('chat-header').classList.remove('hidden');
    document.getElementById('chat-container').classList.remove('hidden');


    document.getElementById('chat-peer-name').textContent = chat.name;
    document.getElementById('chat-avatar').src = chat.avatar_url || '/static/img/default-avatar.png';
    document.getElementById('chat-peer-status').textContent = chat.is_online ? 'online' : 'offline';

    const messagesEl = document.getElementById('messages');
    messagesEl.innerHTML = '';
    earliestTimestamp = null;
    messagesEl.removeEventListener('scroll', onScrollHistory);
    messagesEl.addEventListener('scroll', onScrollHistory);

    loadChatHistory(chatId).then(() => {
        messagesEl.scrollTop = messagesEl.scrollHeight;
    });

    currentChatId = chatId;
    openWebSocketForChat(chatId);
}

async function loadChatHistory(chatId) {
    const messagesEl = document.getElementById('messages');

    let url = `/api/chat/rooms/${chatId}/messages/`;
    if (earliestTimestamp) {
        url += `?before=${encodeURIComponent(earliestTimestamp)}`;
    }

    try {
        const res = await apiFetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const history = await res.json();
        if (!history.length) return;

        earliestTimestamp = history[history.length - 1].timestamp;

        const oldScrollHeight = messagesEl.scrollHeight;

        history.forEach(msg => {
            const div = document.createElement('div');
            if (msg.type === 'info') {
                div.textContent = `— ${msg.text} —`;
                div.style.fontStyle = 'italic';
                div.style.textAlign = 'center';
            } else {
                div.textContent = `[${msg.timestamp}] ${msg.username}: ${msg.text}`;
            }
            messagesEl.prepend(div);
        });
        const newScrollHeight = messagesEl.scrollHeight;
        messagesEl.scrollTop = newScrollHeight - oldScrollHeight;
    } catch (err) {
        console.error('Ошибка загрузки истории:', err);
    }
    
}

async function onScrollHistory() {
    const messagesEl = document.getElementById('messages');
    if (messagesEl.scrollTop < 50) {
        await loadChatHistory(currentChatId);
    }
}

function openWebSocketForChat(chatId) {
    if (ws) {
        ws.close();
        ws = null;
    }

    const token = localStorage.getItem('accessToken');
    const url = `ws://${window.location.host}/ws/chat/${chatId}/?token=${encodeURIComponent(token)}`;
    ws = new WebSocket(url);

    ws.onopen = () => {
        console.log('WS открыт для чата', chatId);
    };

    ws.onmessage = event => {
        let data;
        try {
            data = JSON.parse(event.data);
        } catch {
            return appendRawTextToUI(event.data);
        }
        appendMessageToUI({
            username: data.username,
            message: data.text,
            timestamp: data.timestamp,
            msg_type: data.msg_type
        });
    };

    ws.onclose = evt => {
        console.log('WS закрыт', evt);
        if (evt.code !== 1000 && currentChatId) {
            setTimeout(() => openWebSocketForChat(currentChatId), 1000);
        }
    };

    ws.onerror = err => {
        console.error('WS ошибка', err);
    };
}


function appendMessageToUI({ username, message, timestamp, msg_type }) {
    const messagesEl = document.getElementById('messages');
    const div = document.createElement('div');
    if (msg_type === 'info') {
        div.textContent = `— ${message} —`;
        div.style.fontStyle = 'italic';
        div.style.textAlign = 'center';
    } else {
        div.textContent = `[${timestamp}] ${username}: ${message}`;
    }
    messagesEl.append(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

function appendRawTextToUI(text) {
    const messagesEl = document.getElementById('messages');
    const div = document.createElement('div');
    div.textContent = text;
    div.style.fontStyle = 'italic';
    messagesEl.append(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

document.getElementById('chat-send-btn').addEventListener('click', sendMessage);
document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
    const textEl = document.getElementById('chat-input');
    const message = textEl.value.trim();
    if (!message || !ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(JSON.stringify({ nickname: currentNick, message }));
    textEl.value = '';
}
