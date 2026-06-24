document.addEventListener('DOMContentLoaded', () => {

    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const sendChatBtn = document.getElementById('sendChatBtn');
    const clearChatBtn = document.getElementById('clearChatBtn');
    
    const FIREBASE_CHAT_URL = 'https://tvku-48c77-default-rtdb.asia-southeast1.firebasedatabase.app/chat.json';
    let lastRenderedMessages = "{}";

    function renderMessage(msg) {
        const isSelf = msg.sender === 'Admin';
        const msgDiv = document.createElement('div');
        msgDiv.style.maxWidth = '70%';
        msgDiv.style.padding = '10px 14px';
        msgDiv.style.borderRadius = '12px';
        msgDiv.style.color = 'white';
        msgDiv.style.marginBottom = '8px';
        msgDiv.style.fontFamily = "'Outfit', sans-serif";
        msgDiv.style.alignSelf = isSelf ? 'flex-end' : 'flex-start';
        msgDiv.style.backgroundColor = isSelf ? 'var(--primary-color)' : 'rgba(255, 255, 255, 0.1)';

        const senderSpan = document.createElement('div');
        senderSpan.style.fontSize = '10px';
        senderSpan.style.color = 'rgba(255, 255, 255, 0.7)';
        senderSpan.style.marginBottom = '4px';
        senderSpan.innerText = msg.sender;

        const textSpan = document.createElement('div');
        textSpan.style.fontSize = '14px';
        textSpan.innerText = msg.text;

        msgDiv.appendChild(senderSpan);
        msgDiv.appendChild(textSpan);
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function fetchChat() {
        fetch(FIREBASE_CHAT_URL)
            .then(res => res.json())
            .then(data => {
                if (!data) {
                    if (lastRenderedMessages !== "null") {
                        chatMessages.innerHTML = '';
                        lastRenderedMessages = "null";
                    }
                    return;
                }
                const stringified = JSON.stringify(data);
                if (stringified !== lastRenderedMessages) {
                    lastRenderedMessages = stringified;
                    chatMessages.innerHTML = '';
                    // Sort by timestamp
                    const messages = Object.values(data).sort((a, b) => a.timestamp - b.timestamp);
                    messages.forEach(renderMessage);
                }
            })
            .catch(err => console.error("Firebase chat fetch error", err));
    }

    // Fetch chat every 2 seconds
    setInterval(fetchChat, 2000);
    fetchChat();

    sendChatBtn.addEventListener('click', () => {
        const text = chatInput.value.trim();
        if (text) {
            const msg = {
                sender: 'Admin',
                text: text,
                timestamp: Date.now()
            };
            fetch(FIREBASE_CHAT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(msg)
            }).then(() => {
                chatInput.value = '';
                fetchChat();
            });
        }
    });

    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendChatBtn.click();
        }
    });

    clearChatBtn.addEventListener('click', () => {
        if (confirm("Are you sure you want to clear the entire chat history?")) {
            fetch(FIREBASE_CHAT_URL, {
                method: 'DELETE'
            }).then(() => {
                chatMessages.innerHTML = '';
                lastRenderedMessages = "null";
            });
        }
    });
});
