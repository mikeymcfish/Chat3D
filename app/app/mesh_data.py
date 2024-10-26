# mesh_data.py
from dataclasses import dataclass, asdict
import json
import os
from pathlib import Path

@dataclass
class MeshMetadata:
    mesh_name: str  # The actual mesh name in the 3D scene
    display_name: str  # User-friendly name
    description: str
    category: str
    aliases: list[str]  # Alternative names or descriptions
    properties: dict = None

class MeshDataManager:
    def __init__(self):
        self.mesh_data = {}
        self.app_root = Path(__file__).parent
        self.metadata_path = self.app_root / 'static' / 'mesh_metadata.json'
        print(f"Looking for mesh metadata at: {self.metadata_path}")
        self.load_data()

    def load_data(self):
        try:
            with open(self.metadata_path, 'r') as f:
                self.mesh_data = json.load(f)
                print(f"Successfully loaded mesh data: {self.mesh_data}")
        except FileNotFoundError:
            print(f"File not found at {self.metadata_path}, creating default data")
            self.mesh_data = {
                "Item": {
                    "mesh_name": "Item",  # Actual mesh name in the scene
                    "display_name": "Front Panel Assembly",
                    "description": "The main front panel assembly component",
                    "category": "assembly",
                    "aliases": ["front panel", "main panel", "panel"],  # Common ways to refer to this part
                    "properties": {
                        "material": "steel",
                        "part_number": "ASM-001",
                        "weight": "2.5kg"
                    }
                }
                # Add more items as needed
            }
            self.save_data()

    def save_data(self):
        self.metadata_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.metadata_path, 'w') as f:
            json.dump(self.mesh_data, f, indent=2)
            print(f"Successfully saved mesh data to {self.metadata_path}")

    def get_mesh_by_description(self, query):
        """Find mesh name based on description, display name, or aliases"""
        query = query.lower()
        for mesh_id, data in self.mesh_data.items():
            # Check display name
            if query in data['display_name'].lower():
                print("Found the mesh by display name!")
                return data['mesh_name']
            # Check description
            if query in data['description'].lower():
                print("Found the mesh by description!")
                return data['mesh_name']
            # Check aliases
            if any(query in alias.lower() for alias in data.get('aliases', [])):
                print("Found the mesh by alias!")
                return data['mesh_name']
        return None


    def get_mesh_info(self, mesh_name):
        return self.mesh_data.get(mesh_name)

    def add_mesh_info(self, mesh_name, display_name, description, category, properties=None):
        self.mesh_data[mesh_name] = {
            "mesh_name": mesh_name,
            "display_name": display_name,
            "description": description,
            "category": category,
            "properties": properties or {}
        }
        self.save_data()

    def get_all_mesh_info(self):
        return self.mesh_data

    def search_mesh_by_description(self, query):
        """Search for meshes based on description or display name"""
        results = []
        for mesh_id, data in self.mesh_data.items():
            if (query.lower() in data['description'].lower() or 
                query.lower() in data['display_name'].lower()):
                results.append(data)
        return results

    def print_debug_info(self):
        """Print debug information about paths and file existence"""
        print("\n=== Mesh Data Manager Debug Info ===")
        print(f"App root path: {self.app_root}")
        print(f"Metadata file path: {self.metadata_path}")
        print(f"Metadata file exists: {self.metadata_path.exists()}")
        print(f"Current working directory: {os.getcwd()}")
        print(f"Directory contents of app root:")
        for item in self.app_root.iterdir():
            print(f"  {item}")
        if self.app_root.joinpath('static').exists():
            print(f"Contents of static directory:")
            for item in self.app_root.joinpath('static').iterdir():
                print(f"  {item}")