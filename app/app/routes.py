from flask import Blueprint, render_template, jsonify, request
from openai import OpenAI
import json
import time
import os
from app.mesh_data import MeshDataManager
import whisper
import pvleopard
import tempfile

main = Blueprint('main', __name__)
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
ASSISTANT_ID = "asst_P2lDWKENgOXJ6tLkTh242brA"
# Initialize the mesh data manager
mesh_manager = MeshDataManager()

def get_mesh_info():
    """Endpoint to get all mesh information"""
    return jsonify(mesh_manager.get_all_mesh_info())

leopard = pvleopard.create(access_key='TH9yS5xchLqSFS2mKrhHZWfw6bWAZg7M7vPZG/WWfyRP/T6mywKIFg==')
def process_with_whisper(audio_file):
    # Save the uploaded file to a temporary location
    with tempfile.NamedTemporaryFile(delete=False) as temp_file:
        audio_file.save(temp_file.name)
        temp_file_path = temp_file.name

    # Process the audio file with Leopard
    transcript, words = leopard.process_file(temp_file_path)
    print(transcript)
    for word in words:
        print(
            "{word=\"%s\" start_sec=%.2f end_sec=%.2f confidence=%.2f}"
            % (word.word, word.start_sec, word.end_sec, word.confidence)
        )
    
    # Optionally, delete the temporary file after processing
    os.remove(temp_file_path)

    return transcript
    
@main.route('/')
def index():
    return render_template('index.html')

@main.route('/api/whisper', methods=['POST'])
def whisper():
    audio_file = request.files['file']
    # Process the audio file with Whisper
    transcript = process_with_whisper(audio_file)
    return jsonify({'transcript': transcript})

@main.route('/api/tts', methods=['POST'])
def tts():
    text = request.json.get('text')
    # Generate speech with OpenAI TTS
    audio_url = generate_speech(text)
    return jsonify({'audio_url': audio_url})

def generate_speech(text):
    """
    Generate speech audio from text using OpenAI's TTS API
    
    Args:
        text (str): Text to be converted to speech
    
    Returns:
        str: URL or path to the generated audio file
    """
    try:
        # Generate speech using OpenAI's TTS
        speech_response = client.audio.speech.create(
            model="tts-1-hd",  # You can also use "tts-1-hd" for higher quality
            voice="echo",  # Options: alloy, echo, fable, onyx, nova, shimmer
            input=text,
            speed = 1.25
        )
        
        # Create a unique filename for the audio
        import os
        import uuid
        
        # Construct the full path to the static/audio directory
        base_dir = os.path.dirname(os.path.abspath(__file__))
        audio_dir = os.path.join(base_dir, 'static', 'audio')
        
        # Ensure static/audio directory exists
        os.makedirs(audio_dir, exist_ok=True)
        
        # Generate a unique filename
        filename = f'speech_{uuid.uuid4()}.mp3'
        full_path = os.path.join(audio_dir, filename)
        
        # Write the audio to a file
        speech_response.stream_to_file(full_path)
        
        # Return the URL path to the audio file
        return f'/static/audio/{filename}'
    
    except Exception as e:
        print(f"Error generating speech: {e}")
        return None

@main.route('/api/chat', methods=['POST'])
def chat():
    ASSISTANT_ID = "asst_P2lDWKENgOXJ6tLkTh242brA"
    
    message = request.json.get('message')
    thread_id = request.json.get('thread_id')
    
    try:
        print("\n=== Starting new chat request ===")
        print(f"Message: {message}")
        print(f"Thread ID: {thread_id}")
        
        if not thread_id:
            thread = client.beta.threads.create()
            thread_id = thread.id
            print(f"Created new thread: {thread_id}")
            
            # Send mesh information as context
            mesh_info = mesh_manager.get_all_mesh_info()
            context_message = (
                "3D Model Information:\n\n"
                "Available components and their descriptions:\n\n"
            )
            
            for mesh_name, data in mesh_info.items():
                context_message += (
                    f"Component: {data['display_name']}\n"
                    f"Internal mesh name: {data['mesh_name']}\n"
                    f"Description: {data['description']}\n"
                    f"Alternative names: {', '.join(data.get('aliases', []))}\n"
                    f"Properties: {json.dumps(data['properties'], indent=2)}\n\n"
                )
            
            print("Sending initial context:", context_message)
            client.beta.threads.messages.create(
                thread_id=thread_id,
                role="user",
                content=context_message
            )
        
        # Add the user's message
        print("Adding user message to thread:", message)
        message_obj = client.beta.threads.messages.create(
            thread_id=thread_id,
            role="user",
            content=message
        )
        print("Message object created:", message_obj)
        
        # Run the assistant
        run = client.beta.threads.runs.create(
            thread_id=thread_id,
            assistant_id=ASSISTANT_ID
        )
        print(f"Started run: {run.id}")
        
        while True:
            run_status = client.beta.threads.runs.retrieve(
                thread_id=thread_id,
                run_id=run.id
            )
            print(f"Run status: {run_status.status}")
            
            if run_status.status == 'completed':
                break
            elif run_status.status == 'requires_action':
                print("\n=== Action Required ===")
                required_actions = run_status.required_action.submit_tool_outputs.tool_calls
                print(f"Required actions: {required_actions}")
                
                tool_outputs = []
                for action in required_actions:
                    try:
                        args = json.loads(action.function.arguments)
                        # Ensure function name matches exactly
                        if action.function.name == "get_mesh_info":
                            result = mesh_manager.get_mesh_info(args["mesh_name"])
                        elif action.function.name == "search_mesh_by_description":
                            result = mesh_manager.search_mesh_by_description(args["query"])
                        elif action.function.name == "get_mesh_by_description":
                            result = mesh_manager.get_mesh_by_description(args["query"])
                        elif action.function.name in ["highlight_object", "zoom_to_object"]:
                            mesh_name = args["mesh_name"]
                            result = {
                                "status": "success",
                                "mesh_name": mesh_name,
                                "color": args.get("color", "#FF0000")
                            }
                        # Add the result to tool outputs
                        tool_outputs.append({
                            "tool_call_id": action.id,
                            "output": json.dumps(result) if result is not None else json.dumps({"status": "error", "message": "Function failed or not found"})
                        })
                        
                    except json.JSONDecodeError as e:
                        # Log JSON parsing errors
                        print(f"Error parsing function arguments: {e}")
                        tool_outputs.append({
                            "tool_call_id": action.id,
                            "output": json.dumps({"status": "error", "message": "Invalid arguments format"})
                        })
                    except Exception as e:
                        # Log any other errors
                        print(f"Error processing function: {e}")
                        tool_outputs.append({
                            "tool_call_id": action.id,
                            "output": json.dumps({"status": "error", "message": str(e)})
                        })
                
                print(f"Submitting tool outputs: {tool_outputs}")
                run = client.beta.threads.runs.submit_tool_outputs(
                    thread_id=thread_id,
                    run_id=run.id,
                    tool_outputs=tool_outputs
                )
            elif run_status.status in ['failed', 'cancelled', 'expired']:
                error_msg = f"Run failed with status: {run_status.status}"
                print(f"Error: {error_msg}")
                return jsonify({
                    "error": error_msg,
                    "thread_id": thread_id
                }), 500
            time.sleep(0.5)
        
        # Get the latest messages
        messages = client.beta.threads.messages.list(thread_id=thread_id)
        print("\n=== Latest Messages ===")
        for msg in messages.data:
            print(f"\nMessage ID: {msg.id}")
            print(f"Role: {msg.role}")
            print(f"Content type: {type(msg.content)}")
            print(f"Raw content: {msg.content}")
        
        # Get the assistant's response
        assistant_messages = [msg for msg in messages.data 
                            if msg.role == "assistant" and msg.run_id == run.id]
        
        print("\n=== Assistant Response ===")
        response = None
        if assistant_messages:
            latest_message = assistant_messages[0]
            print(f"Latest message: {latest_message}")
            print(f"Content: {latest_message.content}")
            
            if latest_message.content:
                for content_item in latest_message.content:
                    if hasattr(content_item, 'text'):
                        response = content_item.text.value
                        break
        
        if not response:
            response = "No response from assistant"
            
        print(f"Final response: {response}")
        
        # Parse actions from the run steps
        actions = []
        run_steps = client.beta.threads.runs.steps.list(
            thread_id=thread_id,
            run_id=run.id
        )
        
        for step in run_steps.data:
            if step.type == 'tool_calls':
                for tool_call in step.step_details.tool_calls:
                    if tool_call.type == 'function':
                        try:
                            actions.append({
                                'name': tool_call.function.name,
                                'parameters': json.loads(tool_call.function.arguments)
                            })
                        except json.JSONDecodeError as e:
                            print(f"Error parsing function arguments: {e}")
        
        response_data = {
            "response": response,
            "actions": actions,
            "thread_id": thread_id
        }
        
        print(f"\nFinal response data: {response_data}")
        return jsonify(response_data)
        
    except Exception as e:
        # Log any errors in the chat endpoint
        print(f"\nError in chat endpoint: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return jsonify({
            "error": str(e),
            "thread_id": thread_id
        }), 500
