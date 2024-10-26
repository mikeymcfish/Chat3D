// static/js/chat.js
import { highlightObject, resetHighlight, zoomToObject } from './scene.js';

let currentThreadId = null;

function addMessage(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', `${role}-message`);
    messageDiv.textContent = content;
    document.getElementById('chat-messages').appendChild(messageDiv);
    messageDiv.scrollIntoView({ behavior: 'smooth' });
}

function handleAssistantResponse(data) {
    if (data.error) {
        addMessage('error', `Error: ${data.error}`);
        return;
    }
    console.log("received response");
    console.log(data);

    // Parse the response if it's a string
    let message;
    try {
        if (typeof data.response === 'string') {
            const parsedResponse = JSON.parse(data.response);
            if (parsedResponse.response) {
                message = parsedResponse.response;
            } else {
                addMessage('error', 'Error: Unable to find message in parsed response');
                // return;
            }
        } else if (data.response && data.response.message) {
            message = data.response.message;
        } else {
            addMessage('error', 'Error: Unable to find message in response');
            // return;
        }
    } catch (error) {
        addMessage('error', `Error parsing response: ${error.message}`);
        return;
    }

    console.log(message);
    console.log(data.thread_id);
    currentThreadId = data.thread_id;
    addMessage('assistant', message);
    
    // Handle any actions
    if (data.actions) {
        data.actions.forEach(action => {
            switch (action.name) {
                case 'highlight_object':
                    highlightObject(action.parameters.mesh_name, action.parameters.color);
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