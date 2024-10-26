from flask import Blueprint, render_template, jsonify, request
from openai import OpenAI
import json
import time
import os
from app.mesh_data import MeshDataManager


main = Blueprint('main', __name__)
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
ASSISTANT_ID = "asst_P2lDWKENgOXJ6tLkTh242brA"
# Initialize the mesh data manager
mesh_manager = MeshDataManager()

def get_mesh_info():
    """Endpoint to get all mesh information"""
    return jsonify(mesh_manager.get_all_mesh_info())


@main.route('/')
def index():
    return render_template('index.html')

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
                            mesh_name = mesh_manager.get_mesh_by_description(args["mesh_name"])
                            if mesh_name:
                                result = {
                                    "status": "success",
                                    "mesh_name": mesh_name,
                                    "color": args.get("color", "#FF0000")
                                }
                            else:
                                result = {
                                    "status": "error",
                                    "message": f"Could not find mesh with description: {args['mesh_name']}"
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
