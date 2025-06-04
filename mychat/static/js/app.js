document.addEventListener('DOMContentLoaded', () => {
    const accessToken = localStorage.getItem('access_token');

    if (!accessToken) {
        document.getElementById('login-form').style.display = 'block';

        document.getElementById('sidebar').querySelectorAll('ul, form[id="create-room-form"]').forEach(el => el.style.display = 'none');
        document.getElementById('main-content').style.display = 'none';
    } else {
        enterLoggedInState();
    }

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        if (!username || !password) return;

        try {
            const response = await fetch('/api/token/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            if (!response.ok) {
                throw new Error('Неверный логин или пароль');
            }

            const data = await response.json();
            localStorage.setItem('access_token', data.access);
            localStorage.setItem('refresh_token', data.refresh);

            enterLoggedInState();
        } catch (error) {
            const errEl = document.getElementById('login-error');
            errEl.textContent = error.message || 'Ошибка при входе';
            errEl.style.display = 'block';
        }
    });
});

function enterLoggedInState() {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('login-error').style.display = 'none';

    document.getElementById('room-list').style.display = 'block';
    document.getElementById('create-room-form').style.display = 'block';

    document.getElementById('main-content').style.display = 'block';

    fetchMemberships();
}

async function fetchMemberships() {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) return;

    try {
        const response = await fetch('/api/memberships/', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
                window.location.reload();
            }
            throw new Error('Ошибка при получении списка комнат');
        }

        const memberships = await response.json();
        renderRoomList(memberships);
    } catch (error) {
        console.error(error);
    }
}

function renderRoomList(memberships) {
    const roomListEl = document.getElementById('room-list');
    roomListEl.innerHTML = '';
    title = document.createElement('h2');
    title.textContent = 'Мои комнаты';
    roomListEl.append(title);

    memberships.forEach(membership => {
        const li = document.createElement('li');
        li.textContent = membership.room.name;
        li.setAttribute('data-room-id', membership.room.id);
        li.style.cursor = 'pointer';
        li.addEventListener('click', () => {
            selectRoom(membership.room.id, membership.room.name);
        });
        roomListEl.append(li);
    });
}

document.getElementById('create-room-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const roomName = document.getElementById('new-room-name').value.trim();
    const errorEl = document.getElementById('create-room-error');
    errorEl.style.display = 'none';
    if (!roomName) return;

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    try {
        const createRes = await fetch('/api/rooms/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ name: roomName })
        });
        if (createRes.status === 400) {
            const errData = await createRes.json();
            throw new Error(errData.name ? JSON.stringify(errData.name) : 'Ошибка создания');
        }
        if (!createRes.ok) throw new Error('Ошибка создания комнаты');

        const newRoom = await createRes.json();

        await fetchMemberships();

        selectRoom(newRoom.id, newRoom.name);

        document.getElementById('new-room-name').value = '';
        errorEl.style.display = 'none';
    } catch (err) {
        errorEl.textContent = err.message;
        errorEl.style.display = 'block';
    }
});

let ws = null;
let currentRoomId = null;
let currentRoomName = null;
let currentNick = null;


async function ensureNick() {
    if (!currentNick) {
        const accessToken = localStorage.getItem('access_token');
        try {
            const response = await fetch('/api/profile/', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });
            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('refresh_token');
                    window.location.reload();
                }
                throw new Error('Ошибка при получении списка комнат');
            }

            const data = await response.json();
            return data.nickname;
        } catch (error) {
            console.error(error);
        }
    }
}

function selectRoom(roomId, roomName) {
    const nickname = ensureNick();
    console.log('Selected room:', roomId, roomName, nickname);
    document.getElementById('current-room-title').textContent = 'Чат: ' + roomName;

    if (ws) {
        ws.close();
        ws = null;
    }

    const url = `ws://${window.location.host}/ws/chat/?nick=${nickname}&room=${roomName}`;
    ws = new WebSocket(url);

    ws.onopen = () => {
        document.getElementById('chat-input').disabled = false;
        document.getElementById('chat-send-btn').disabled = false;
        document.getElementById('messages').innerHTML = '';
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            appendMessageToUI(data);
        } catch (e) {
            appendRawTextToUI(event.data);
        }
    };

    ws.onclose = () => {
        document.getElementById('chat-input').disabled = true;
        document.getElementById('chat-send-btn').disabled = true;
    };

    ws.onerror = (err) => {
        console.error('WebSocket error:', err);
    };
}

function appendMessageToUI({ nickname, message, timestamp }) {
    const messagesEl = document.getElementById('messages');
    const div = document.createElement('div');
    div.textContent = `[${timestamp}] ${nickname}: ${message}`;
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
