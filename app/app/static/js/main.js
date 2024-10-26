// static/js/scene.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let scene, camera, renderer, controls, meshes = {};

// Export for use in chat.js
export function highlightObject(meshName, color = '#FF0000') {
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

export function resetHighlight(meshName) {
    const mesh = meshes[meshName];
    if (mesh && mesh.userData.originalMaterial) {
        mesh.material = mesh.userData.originalMaterial;
    }
}

export function zoomToObject(meshName) {
    const mesh = meshes[meshName];
    if (mesh) {
        const box = new THREE.Box3().setFromObject(mesh);
        const center = new THREE.Vector3();
        box.getCenter(center);
        camera.position.set(center.x, center.y, center.z + 5);
        camera.lookAt(center);
        controls.target.copy(center);
        controls.update();
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

    // Add test cube
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshPhongMaterial({ 
        color: 0x00ff00,
        flatShading: true
    });
    const cube = new THREE.Mesh(geometry, material);
    cube.position.set(0, 0.5, 0);
    scene.add(cube);

    // Load GLB model
    const loader = new GLTFLoader();
    
    loader.load('/static/models/your-model.glb', 
        function(gltf) {
            console.log('Model loaded successfully');
            scene.add(gltf.scene);
            
            gltf.scene.traverse(function(child) {
                if (child.isMesh) {
                    meshes[child.name] = child;
                    console.log('Found mesh:', child.name);
                }
            });

            const box = new THREE.Box3().setFromObject(gltf.scene);
            const center = new THREE.Vector3();
            box.getCenter(center);
        },
        function(xhr) {
            console.log('Loading progress:', (xhr.loaded / xhr.total * 100) + '%');
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