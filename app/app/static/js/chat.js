// static/js/chat.js
import { highlightObject, resetHighlight, zoomToObject } from './scene.js';
let currentThreadId = null;

function addMessage(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', `${role}-message`);
    messageDiv.innerHTML = marked.parse(content); // Convert Markdown to HTML
    document.getElementById('chat-messages').appendChild(messageDiv);
    messageDiv.scrollIntoView({ behavior: 'smooth' });
}

function extractMessage(data) {
    console.log("Received response:", data);
    
    let message = data.response;
    
    // Helper function to safely parse JSON and extract message
    const tryParseAndExtract = (content) => {
        try {
            if (typeof content === 'string') {
                const parsed = JSON.parse(content);
                // Check common message field names
                return parsed.response_text || 
                       parsed.response || 
                       parsed.message || 
                       parsed.paragraph ||
                       parsed.content ||
                       (typeof parsed === 'string' ? parsed : null);
            }
            return content;
        } catch (e) {
            return content;
        }
    };

    // Try parsing up to 3 levels deep
    for (let i = 0; i < 3; i++) {
        const extracted = tryParseAndExtract(message);
        if (extracted === message) break; // Stop if no more parsing needed
        message = extracted;
    }

    console.log("Final extracted message:", message);
    return message;
}

function handleAssistantResponse(data) {
    if (data.error) {
        addMessage('error', `Error: ${data.error}`);
        return;
    }

    const message = extractMessage(data);
    currentThreadId = data.thread_id;
    addMessage('assistant', message);

    // Recursively search for actions in the JSON object
    const actions = findActions(data);

    // Handle any actions found
    if (actions.length > 0) {
        actions.forEach(action => {
            switch (action.name) {
                case 'highlight_object':
                    highlightObject(action.parameters.mesh_name, action.parameters.color, action.parameters.label_text);
                    break;
                case 'zoom_to_object':
                    zoomToObject(action.parameters.mesh_name);
                    break;
                case 'reset_highlight':
                    resetHighlight(action.parameters.mesh_name);
                    break;
                default:
                    console.log(`Unknown action: ${action.name}`);
                    break;
            }
        });
    }
}

// Utility function to recursively find actions in a JSON object
function findActions(obj) {
    let actions = [];

    if (Array.isArray(obj)) {
        obj.forEach(item => {
            actions = actions.concat(findActions(item));
        });
    } else if (typeof obj === 'object' && obj !== null) {
        for (const key in obj) {
            if (key === 'actions' && Array.isArray(obj[key])) {
                actions = actions.concat(obj[key]);
            } else {
                actions = actions.concat(findActions(obj[key]));
            }
        }
    }

    return actions;
}

// Chat input handler
const chatInput = document.getElementById('chat-input');
chatInput.addEventListener('keypress', async function(e) {
    if (e.key === 'Enter' && chatInput.value.trim()) {
        const message = chatInput.value.trim();
        addMessage('user', message);
        chatInput.value = '';
        chatInput.disabled = true;

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    thread_id: currentThreadId
                })
            });

            const data = await response.json();
            handleAssistantResponse(data);
        } catch (error) {
            addMessage('error', `Error: ${error.message}`);
        } finally {
            chatInput.disabled = false;
            chatInput.focus();
        }
    }
});
