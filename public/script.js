// Check authentication
document.addEventListener('DOMContentLoaded', function() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    // Se non loggato, reindirizza al login
    if (!token || !user) {
        window.location.href = '/login';
        return;
    }
    
    // Usa l'utente loggato
    const userData = JSON.parse(user);
    console.log('Logged in as:', userData.name);
});

// Carica Socket.IO client se necessario e inizializza la connessione
function initSocketClient() {
    const token = localStorage.getItem('token');
    if (!token) return null;
    if (typeof io === 'undefined') {
        const s = document.createElement('script');
        s.src = '/socket.io/socket.io.js';
        s.onload = initSocketClient;
        document.head.appendChild(s);
        return null;
    }

    try {
        const socket = io({ auth: { token } });
        socket.on('connect_error', (err) => console.error('Socket connect error', err));
        socket.on('new_message', (msg) => {
            const messagesDiv = document.querySelector('.chat-messages');
            if (!messagesDiv) return;
            const newMessage = document.createElement('div');
            newMessage.className = (msg.sender_id === JSON.parse(localStorage.getItem('user') || '{}').id) ? 'message-row sent' : 'message-row received';
            newMessage.innerHTML = `<div class="message">${msg.content}</div>`;
            messagesDiv.appendChild(newMessage);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        });
        return socket;
    } catch (err) {
        console.error('Could not init socket client', err);
        return null;
    }
}

window.socket = null;
window.addEventListener('load', () => {
    window.socket = initSocketClient();
});

// Menu mobile and responsive behavior removed (fixed layout)

// Smooth Scroll
function scrollTo(selector) {
    const element = document.querySelector(selector);
    element?.scrollIntoView({ behavior: 'smooth' });
}

// Like Profile
function likeProfile() {
    const card = document.querySelector('.profile-card');
    card.style.animation = 'slideRight 0.3s';
    setTimeout(() => {
        alert('❤️ Ti piace! Match possibile!');
        // Reload new profile
        location.reload();
    }, 300);
}

// Reject Profile
function rejectProfile() {
    const card = document.querySelector('.profile-card');
    card.style.animation = 'slideLeft 0.3s';
    setTimeout(() => {
        // Reload new profile
        location.reload();
    }, 300);
}

// Form Submission
document.addEventListener('DOMContentLoaded', function() {
    const profileForm = document.querySelector('form');
    if (profileForm) {
        profileForm.addEventListener('submit', function(e) {
            e.preventDefault();
            alert('✅ Profilo salvato con successo!');
        });
    }

    // Message Send
    const chatInput = document.querySelector('.chat-input');
    if (chatInput) {
        const sendBtn = chatInput.querySelector('.btn');
        const input = chatInput.querySelector('input');
        if (sendBtn && input) {
            sendBtn.addEventListener('click', function() {
                if (input.value.trim()) {
                    const messagesDiv = document.querySelector('.chat-messages');
                    const matchId = chatInput.dataset.matchId || chatInput.getAttribute('data-match-id');

                    // If socket connected, send through socket
                    if (window.socket && matchId) {
                        window.socket.emit('send_message', { matchId: parseInt(matchId, 10), content: input.value }, (resp) => {
                            if (resp && resp.ok) {
                                // message will be added via new_message event; optionally append immediately
                            } else {
                                console.error('Message send error', resp);
                            }
                        });
                    } else {
                        if (messagesDiv) {
                            const newMessage = document.createElement('div');
                            newMessage.className = 'message-row sent';
                            newMessage.innerHTML = `<div class="message">${input.value}</div>`;
                            messagesDiv.appendChild(newMessage);
                            messagesDiv.scrollTop = messagesDiv.scrollHeight;
                        }
                    }

                    input.value = '';
                }
            });

            // Send on Enter
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    sendBtn.click();
                }
            });
        }
    }
});

// Logout function
function logout() {
    if (confirm('Sei sicuro di voler effettuare il logout?')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
    }
}

// Animazioni CSS
const style = document.createElement('style');
style.innerHTML = `
    @keyframes slideRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    @keyframes slideLeft {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(-100%); opacity: 0; }
    }
`;
document.head.appendChild(style);
