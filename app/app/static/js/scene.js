// static/js/scene.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let scene, camera, renderer, controls, meshes = {};

// Export for use in chat.js
export function highlightObject(meshName, color = '#FF0000') {
    console.log('Attempting to highlight:', meshName);
    const mesh = meshes[meshName];
    if (mesh) {
        console.log('Found mesh to highlight:', meshName);
        if (!mesh.userData.originalMaterial) {
            mesh.userData.originalMaterial = mesh.material.clone();
        }
        const highlightMaterial = mesh.userData.originalMaterial.clone();
        highlightMaterial.emissive.setHex(parseInt(color.replace('#', '0x')));
        highlightMaterial.emissiveIntensity = 0.5;
        mesh.material = highlightMaterial;
    } else {
        console.log('Mesh not found:', meshName);
        console.log('Available meshes:', Object.keys(meshes));
    }
}

export function resetHighlight(meshName) {
    const mesh = meshes[meshName];
    if (mesh && mesh.userData.originalMaterial) {
        mesh.material = mesh.userData.originalMaterial;
    }
}

export function zoomToObject(meshName) {
    console.log('Attempting to zoom to:', meshName);
    const mesh = meshes[meshName];
    if (mesh) {
        console.log('Found mesh to zoom to:', meshName);
        const box = new THREE.Box3().setFromObject(mesh);
        const center = new THREE.Vector3();
        box.getCenter(center);
        camera.position.set(center.x, center.y, center.z + 5);
        camera.lookAt(center);
        controls.target.copy(center);
        controls.update();
    } else {
        console.log('Mesh not found for zooming:', meshName);
        console.log('Available meshes:', Object.keys(meshes));
    }
}

function init() {
    console.log('Initializing scene...');
    
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xcccccc);
    
    // Setup camera
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 10;
    camera = new THREE.OrthographicCamera(
        -frustumSize * aspect / 2,
        frustumSize * aspect / 2,
        frustumSize / 2,
        -frustumSize / 2,
        0.1,
        1000
    );
    camera.position.set(5, 5, 5);
    camera.lookAt(0, 0, 0);

    // Setup renderer
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true
    });
    renderer.setSize(window.innerWidth - 300, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Add renderer to DOM
    const container = document.getElementById('scene-container');
    container.appendChild(renderer.domElement);

    // Setup controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = true;
    controls.update();

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    // Add helpers
    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);

    const gridHelper = new THREE.GridHelper(10, 10);
    scene.add(gridHelper);

    // Load GLB model
    const loader = new GLTFLoader();
    console.log('Starting model load...');
    
    loader.load('/static/models/your-model.glb', 
        function(gltf) {
            console.log('Model loaded successfully');
            
            gltf.scene.scale.set(0.03, 0.03, 0.03);
            scene.add(gltf.scene);
            
            // Debug mesh names
            console.log('Scanning model for meshes...');
            gltf.scene.traverse(function(child) {
                if (child.isMesh) {
                    meshes[child.name] = child;
                    console.log('Found mesh:', {
                        name: child.name,
                        position: child.position,
                        scale: child.scale,
                        materialType: child.material.type
                    });
                }
            });

            console.log('Total meshes found:', Object.keys(meshes).length);
            console.log('All mesh names:', Object.keys(meshes));

            // Center camera on model
            const box = new THREE.Box3().setFromObject(gltf.scene);
            const center = new THREE.Vector3();
            box.getCenter(center);
            
            console.log('Model centered at:', center);
            console.log('Model dimensions:', {
                x: box.max.x - box.min.x,
                y: box.max.y - box.min.y,
                z: box.max.z - box.min.z
            });

            // Adjust camera to fit model
            const size = new THREE.Vector3();
            box.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z);
            camera.position.set(
                center.x + maxDim,
                center.y + maxDim,
                center.z + maxDim
            );
            camera.lookAt(center);
            controls.target.copy(center);
            controls.update();
        },
        function(xhr) {
            const percent = (xhr.loaded / xhr.total * 100).toFixed(2);
            console.log('Loading progress:', percent + '%');
        },
        function(error) {
            console.error('Error loading model:', error);
        }
    );

    animate();
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// Handle window resizing
window.addEventListener('resize', function() {
    const aspect = (window.innerWidth - 300) / window.innerHeight;
    const frustumSize = 10;
    
    camera.left = -frustumSize * aspect / 2;
    camera.right = frustumSize * aspect / 2;
    camera.top = frustumSize / 2;
    camera.bottom = -frustumSize / 2;
    
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth - 300, window.innerHeight);
});

// Initialize scene
init();