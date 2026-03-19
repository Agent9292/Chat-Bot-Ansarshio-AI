const BACKENDLESS_API_URL = 'https://lovelyattraction-us.backendless.app/api/services/ChatBot/reply';

function generateUsername() {
    const stored = localStorage.getItem('chatUsername');
    if (stored) return stored;
    
    const newUsername = 'user_' + Math.random().toString(36).substring(2, 10);
    localStorage.setItem('chatUsername', newUsername);
    return newUsername;
}

const USERNAME = generateUsername();

const chatContainer = document.getElementById('chatContainer');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const clearBtn = document.getElementById('clearBtn');

let conversationHistory = [];

function loadConversation() {
    const saved = localStorage.getItem('chatConversation');
    if (saved) {
        try {
            conversationHistory = JSON.parse(saved);
            renderMessages();
        } catch (e) {
            console.error('Error loading conversation:', e);
            conversationHistory = [];
        }
    } else {
        showNewChatPrompt();
    }
}

function showNewChatPrompt() {
    const promptDiv = document.createElement('div');
    promptDiv.className = 'new-chat-indicator';
    promptDiv.innerHTML = '👋 Hello! Ask me anything...';
    chatContainer.innerHTML = '';
    chatContainer.appendChild(promptDiv);
}

function saveConversation() {
    localStorage.setItem('chatConversation', JSON.stringify(conversationHistory));
}

function renderMessages() {
    if (conversationHistory.length === 0) {
        showNewChatPrompt();
        return;
    }

    chatContainer.innerHTML = '';
    conversationHistory.forEach(msg => {
        addMessageToUI(msg.role, msg.content);
    });
}

function addMessageToUI(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role === 'user' ? 'user-message' : 'bot-message'}`;
    
    if (role === 'assistant') {
        const formattedContent = content
            .replace(/\n\n/g, '<br><br>')
            .replace(/\n/g, '<br>');
        messageDiv.innerHTML = formattedContent;
    } else {
        messageDiv.textContent = content;
    }
    
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

async function sendMessageToBackendless(userMessage) {
    try {
        const response = await fetch(BACKENDLESS_API_URL, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                message: userMessage,
                username: USERNAME
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        
        if (typeof data === 'string') {
            return data;
        } else if (data && data.response) {
            return data.response;
        } else if (data && data.message) {
            return data.message;
        } else {
            return JSON.stringify(data);
        }
    } catch (error) {
        console.error('Error calling Backendless API:', error);
        throw error;
    }
}

async function handleSendMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    if (conversationHistory.length === 0) {
        chatContainer.innerHTML = '';
    }

    addMessageToUI('user', message);
    conversationHistory.push({ role: 'user', content: message });
    saveConversation();

    userInput.value = '';
    sendBtn.disabled = true;

    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message bot-message';
    loadingDiv.innerHTML = '<div class="loading"></div> Thinking...';
    chatContainer.appendChild(loadingDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    try {
        const botResponse = await sendMessageToBackendless(message);
        
        if (loadingDiv.parentNode) {
            chatContainer.removeChild(loadingDiv);
        }
        
        addMessageToUI('assistant', botResponse);
        conversationHistory.push({ role: 'assistant', content: botResponse });
        saveConversation();
    } catch (error) {
        if (loadingDiv.parentNode) {
            chatContainer.removeChild(loadingDiv);
        }
        
        let errorMessage = 'Sorry, something went wrong. Please try again.';
        
        if (error.message.includes('Failed to fetch')) {
            errorMessage = 'Network error. Please check your internet connection.';
        } else if (error.message.includes('CORS')) {
            errorMessage = 'CORS error. Trying alternative method...';
            
            try {
                const alternativeResponse = await fetch(BACKENDLESS_API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: message,
                        username: USERNAME
                    })
                });
                
                if (alternativeResponse.ok) {
                    const data = await alternativeResponse.json();
                    const botResponse = typeof data === 'string' ? data : 
                                       data.response || data.message || JSON.stringify(data);
                    
                    addMessageToUI('assistant', botResponse);
                    conversationHistory.push({ role: 'assistant', content: botResponse });
                    saveConversation();
                    return;
                }
            } catch (altError) {
                console.error('Alternative method also failed:', altError);
            }
        }
        
        addMessageToUI('assistant', errorMessage);
        conversationHistory.push({ role: 'assistant', content: errorMessage });
        saveConversation();
    } finally {
        sendBtn.disabled = false;
        userInput.focus();
    }
}

function clearConversation() {
    conversationHistory = [];
    localStorage.removeItem('chatConversation');
    showNewChatPrompt();
    userInput.value = '';
    userInput.focus();
}

sendBtn.addEventListener('click', handleSendMessage);

userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
    }
});

clearBtn.addEventListener('click', clearConversation);

loadConversation();
userInput.focus();

console.log('Your username:', USERNAME);
