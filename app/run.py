from app import create_app
from flask import Flask
from app.mesh_data import MeshDataManager
import os

app = create_app()

# Initialize the mesh data manager with debug info
mesh_manager = MeshDataManager()
mesh_manager.print_debug_info()  # This will print path information to help debug


if __name__ == '__main__':
    app.run(debug=True)
