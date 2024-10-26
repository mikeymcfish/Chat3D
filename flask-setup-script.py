# setup_flask_app.py
import os
import shutil
from pathlib import Path

def create_flask_structure():
    # Define the base structure
    structure = {
        'app': {
            'static': {
                'css': {},
                'js': {},
                'models': {}  # For GLB files
            },
            'templates': {},
            '__init__.py': '''from flask import Flask
from flask_cors import CORS
from config import Config

def create_app(config_class=Config):
    app = Flask(__name__)
    CORS(app)
    app.config.from_object(config_class)
    
    from app.routes import main
    app.register_blueprint(main)
    
    return app
''',
            'routes.py': '''from flask import Blueprint, render_template, jsonify, request
from openai import OpenAI
import json
import time
import os

main = Blueprint('main', __name__)
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
ASSISTANT_ID = "asst_P2lDWKENgOXJ6tLkTh242brA"

@main.route('/')
def index():
    return render_template('index.html')

@main.route('/api/chat', methods=['POST'])
def chat():
    message = request.json.get('message')
    thread_id = request.json.get('thread_id')
    
    try:
        if not thread_id:
            thread = client.beta.threads.create()
            thread_id = thread.id
        
        client.beta.threads.messages.create(
            thread_id=thread_id,
            role="user",
            content=message
        )
        
        run = client.beta.threads.runs.create(
            thread_id=thread_id,
            assistant_id=ASSISTANT_ID
        )
        
        while True:
            run_status = client.beta.threads.runs.retrieve(
                thread_id=thread_id,
                run_id=run.id
            )
            if run_status.status == 'completed':
                break
            elif run_status.status in ['failed', 'cancelled', 'expired']:
                return jsonify({
                    "error": f"Run failed with status: {run_status.status}",
                    "thread_id": thread_id
                }), 500
            time.sleep(0.5)
        
        messages = client.beta.threads.messages.list(thread_id=thread_id)
        
        actions = []
        run_steps = client.beta.threads.runs.steps.list(
            thread_id=thread_id,
            run_id=run.id
        )
        
        for step in run_steps.data:
            if step.type == 'tool_calls':
                for tool_call in step.step_details.tool_calls:
                    if tool_call.type == 'function':
                        actions.append({
                            'name': tool_call.function.name,
                            'parameters': json.loads(tool_call.function.arguments)
                        })
        
        assistant_messages = [msg for msg in messages.data 
                            if msg.role == "assistant" and msg.run_id == run.id]
        
        if assistant_messages:
            response = assistant_messages[0].content[0].text.value
        else:
            response = "No response from assistant"
        
        return jsonify({
            "response": response,
            "actions": actions,
            "thread_id": thread_id
        })
        
    except Exception as e:
        return jsonify({
            "error": str(e),
            "thread_id": thread_id
        }), 500
'''
        },
        'config.py': '''import os
from dotenv import load_dotenv

basedir = os.path.abspath(os.path.dirname(__file__))
load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'your-secret-key-here'
    OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')
''',
        'run.py': '''from app import create_app

app = create_app()

if __name__ == '__main__':
    app.run(debug=True)
''',
        '.env': '''OPENAI_API_KEY=your-api-key-here
SECRET_KEY=your-secret-key-here
''',
        'requirements.txt': '''flask
python-dotenv
openai
flask-cors
''',
        '.gitignore': '''__pycache__/
*.pyc
.env
venv/
.DS_Store
'''
    }

    # Create the HTML template
    index_html = '''<!-- templates/index.html -->
<!DOCTYPE html>
<html>
<head>
    <title>3D Scene Viewer</title>
    <link rel="stylesheet" href="{{ url_for('static', filename='css/style.css') }}">
</head>
<body>
    <div id="container">
        <div id="scene-container"></div>
        <div id="chat-container">
            <div id="chat-messages"></div>
            <input type="text" id="chat-input" placeholder="Type your message...">
        </div>
    </div>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
    <script src="{{ url_for('static', filename='js/main.js') }}"></script>
</body>
</html>
'''

    # Create CSS
    css_content = '''#container {
    display: flex;
    height: 100vh;
}
#scene-container {
    flex: 1;
    height: 100%;
}
#chat-container {
    width: 300px;
    padding: 20px;
    background: #f5f5f5;
    display: flex;
    flex-direction: column;
}
#chat-messages {
    flex: 1;
    overflow-y: auto;
    margin-bottom: 20px;
}
.message {
    margin: 10px 0;
    padding: 10px;
    border-radius: 5px;
}
.user-message {
    background: #e3f2fd;
}
.assistant-message {
    background: #f5f5f5;
}
.error-message {
    background: #ffebee;
    color: #c62828;
}
'''

    # Create JavaScript
    js_content = '''let scene, camera, renderer, controls;
let meshes = {};
let currentThreadId = null;

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / 2 / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth / 2, window.innerHeight);
    document.getElementById('scene-container').appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);

    const light = new THREE.AmbientLight(0x404040);
    scene.add(light);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    scene.add(directionalLight);

    const loader = new THREE.GLTFLoader();
    loader.load('/static/models/your-model.glb', function(gltf) {
        scene.add(gltf.scene);
        gltf.scene.traverse(function(child) {
            if (child.isMesh) {
                meshes[child.name] = child;
            }
        });
    });

    camera.position.z = 5;
    animate();
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

function highlightObject(meshName, color = '#FF0000') {
    const mesh = meshes[meshName];
    if (mesh) {
        if (!mesh.userData.originalMaterial) {
            mesh.userData.originalMaterial = mesh.material.clone();
        }
        const highlightMaterial = mesh.userData.originalMaterial.clone();
        highlightMaterial.emissive.setHex(parseInt(color.replace('#', '0x')));
        highlightMaterial.emissiveIntensity = 0.5;
        mesh.material = highlightMaterial;
    }
}

function resetHighlight(meshName) {
    const mesh = meshes[meshName];
    if (mesh && mesh.userData.originalMaterial) {
        mesh.material = mesh.userData.originalMaterial;
    }
}

function zoomToObject(meshName) {
    const mesh = meshes[meshName];
    if (mesh) {
        const box = new THREE.Box3().setFromObject(mesh);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        camera.position.copy(center);
        camera.position.z += Math.max(size.x, size.y, size.z) * 2;
        controls.target.copy(center);
        controls.update();
    }
}

const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');

chatInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        const message = chatInput.value;
        addMessage('user', message);
        chatInput.disabled = true;
        
        fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                message: message,
                thread_id: currentThreadId
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                addMessage('error', `Error: ${data.error}`);
            } else {
                currentThreadId = data.thread_id;
                addMessage('assistant', data.response);
                
                data.actions.forEach(action => {
                    if (action.name === 'highlight_object') {
                        highlightObject(action.parameters.mesh_name, action.parameters.color);
                    } else if (action.name === 'zoom_to_object') {
                        zoomToObject(action.parameters.mesh_name);
                    }
                });
            }
        })
        .catch(error => {
            addMessage('error', `Error: ${error.message}`);
        })
        .finally(() => {
            chatInput.disabled = false;
            chatInput.value = '';
            chatInput.focus();
        });
    }
});

function addMessage(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', `${role}-message`);
    messageDiv.textContent = content;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

init();

window.addEventListener('resize', function() {
    camera.aspect = window.innerWidth / 2 / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth / 2, window.innerHeight);
});
'''

    # Create directories and files
    def create_directory_structure(base_path, structure):
        for name, content in structure.items():
            path = os.path.join(base_path, name)
            if isinstance(content, dict):
                os.makedirs(path, exist_ok=True)
                create_directory_structure(path, content)
            else:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(content)

    # Create the main project directory
    project_dir = 'flask_threejs_app'
    os.makedirs(project_dir, exist_ok=True)
    
    # Create the structure
    create_directory_structure(project_dir, structure)
    
    # Create additional files
    templates_dir = os.path.join(project_dir, 'app', 'templates')
    with open(os.path.join(templates_dir, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(index_html)
        
    css_dir = os.path.join(project_dir, 'app', 'static', 'css')
    with open(os.path.join(css_dir, 'style.css'), 'w', encoding='utf-8') as f:
        f.write(css_content)
        
    js_dir = os.path.join(project_dir, 'app', 'static', 'js')
    with open(os.path.join(js_dir, 'main.js'), 'w', encoding='utf-8') as f:
        f.write(js_content)

if __name__ == '__main__':
    create_flask_structure()
    print("Flask application structure created successfully!")
    print("\nTo get started:")
    print("1. cd flask_threejs_app")
    print("2. python -m venv venv")
    print("3. source venv/bin/activate  # On Windows: venv\\Scripts\\activate")
    print("4. pip install -r requirements.txt")
    print("5. Add your OpenAI API key to .env file")
    print("6. Add your GLB model to app/static/models/")
    print("7. python run.py")
