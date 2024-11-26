import * as THREE from 'three';
import { currentThreadId, handleAssistantResponse } from './chat.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SAOPass } from 'three/addons/postprocessing/SAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';


let scene, camera, renderer, controls, meshes = {};
let composer, ssaoPass, saoPass, renderPass, fxaaPass;

const labelRenderer = new CSS2DRenderer();
const labels = new Map(); // Store labels by mesh name


/// TO LOOK AT: Decals, LOD, toon material, FXAA, GTAO, SSAA, Outline pass, SAO, bloom pass

// Previous export functions remain unchanged
export function highlightObject(meshName, color = '#00FFFF', labelText = meshName) {
    console.log('Attempting to highlight:', meshName);
    const mesh = meshes[meshName];
    if (!mesh) {
        console.error(`Mesh "${meshName}" not found in meshes.`);
        return;
    }
    try {
        if (!mesh.userData.originalMaterial) {
            mesh.userData.originalMaterial = mesh.material.clone();
        }
        const highlightMaterial = mesh.userData.originalMaterial.clone();
        highlightMaterial.emissive.setHex(parseInt(color.replace('#', '0x')));
        highlightMaterial.emissiveIntensity = 1.5;
        highlightMaterial.color.setHex(0x000000);
        mesh.material = highlightMaterial;
        zoomToObject(meshName);
       
        // Add label if text is provided
        if (labelText) {
            createLabelForObject(meshName, labelText);
        }
    } catch (error) {
        console.error('Error highlighting mesh:', error);
    }
}

export function resetHighlight(meshName) {
    const mesh = meshes[meshName];
    if (mesh && mesh.userData.originalMaterial) {
        mesh.material = mesh.userData.originalMaterial;
        removeLabelFromObject(meshName);
    }
}

export function zoomToObject(meshName) {
    // Ensure the function is correctly defined and exported
    console.log('Attempting to zoom to:', meshName);
    const mesh = meshes[meshName];
    // console.log(meshes);
    if (mesh) {
        console.log('Found mesh to zoom to:', meshName);
        const box = new THREE.Box3().setFromObject(mesh);
        const center = new THREE.Vector3();
        box.getCenter(center);
        // camera.position.set(center.x, center.y, center.z + 5);
        camera.lookAt(center);
        controls.target.copy(center);
        controls.update();
    } else {
        console.log('Mesh not found for zooming:', meshName);
        console.log('Available meshes:', Object.keys(meshes));
    }
}
// Previous export functions remain unchanged...


function init() {
    console.log('Initializing scene...');
   
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xcccccc);
   
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 10;
    camera = new THREE.OrthographicCamera(
        -frustumSize * aspect / 2,
        frustumSize * aspect / 2,
        frustumSize / 2,
        -frustumSize / 2,
        5,
        30
    );
    camera.position.set(5, 5, 5);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        logarithmicDepthBuffer: true,
        powerPreference: 'default'
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    renderer.shadowMap.enabled = false;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const container = document.getElementById('scene-container');
    container.appendChild(renderer.domElement);

    // Setup post-processing
   
    composer = new EffectComposer(renderer);
   
    const renderPass = new RenderPass(scene, camera);


    composer.addPass(renderPass);
    saoPass = new SAOPass( scene, camera );
    saoPass.params.saoBias = 0.2;
    saoPass.params.saoIntensity = 0.045;
    saoPass.params.saoScale = .9;
    saoPass.params.saoKernelRadius = 40.0;
    saoPass.params.saoMinResolution = 0.0;
    saoPass.params.saoBlur = true;
    saoPass.enabled = true;
    composer.addPass( saoPass );
    //const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.45, 0.1, 0.85);
    //composer.addPass(bloomPass);

    const outputPass = new OutputPass();
    composer.addPass(outputPass);

    //fxaaPass = new ShaderPass(FXAAShader);
    //composer.addPass(fxaaPass);
   
    // // Init gui
    // const gui = new GUI();
    // gui.add( saoPass.params, 'output', {
    //     'Default': SAOPass.OUTPUT.Default,
    //     'SAO Only': SAOPass.OUTPUT.SAO,
    //     'Normal': SAOPass.OUTPUT.Normal
    // } ).onChange( function ( value ) {

    //     saoPass.params.output = value;

    // } );
    // gui.add( saoPass.params, 'saoBias', - 1, 1 );
    // gui.add( saoPass.params, 'saoIntensity', 0, 1 );
    // gui.add( saoPass.params, 'saoScale', 0, 10 );
    // gui.add( saoPass.params, 'saoKernelRadius', 1, 100 );
    // gui.add( saoPass.params, 'saoMinResolution', 0, 1 );
    // gui.add( saoPass.params, 'saoBlur' );
    // gui.add( saoPass.params, 'saoBlurRadius', 0, 200 );
    // gui.add( saoPass.params, 'saoBlurStdDev', 0.5, 150 );
    // gui.add( saoPass.params, 'saoBlurDepthCutoff', 0.0, 0.1 );
    // gui.add( saoPass, 'enabled' );

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = true;
    controls.update();

    // Enhanced lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    scene.add(directionalLight);

    // Add a fill light
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-5, 5, -5);
    scene.add(fillLight);

    // Load GLB model
    const loader = new GLTFLoader();
    console.log('Starting model load...');
   
    loader.load('/static/models/your-model.glb',
        function(gltf) {
            console.log('Model loaded successfully');
           
            gltf.scene.scale.set(3,3,3);
            scene.add(gltf.scene);
            let meshNames = [];  // Array to collect mesh names

            gltf.scene.traverse(function(child) {
                if (child.isMesh) {
                    meshes[child.name] = child;
                    // console.log("found mesh:", child.name);
                    meshNames.push(child.name);  // Add name to array

                    // child.material = new THREE.MeshPhongMaterial({ color: 0xaaaaaa });

                    if (child.material) {
                        child.material.needsUpdate = true;
                        child.material.metalness = 0.2;
                        child.material.roughness = 0.8;
                        //child.material.clippingPlanes = [clippingPlane];
                        //child.material.clipIntersection = true; // Optional: clips where planes intersect
                        child.material.transparent = false
                        // child.material.transparent = false; // Disable transparency
                        // child.material.opacity = 1.0; // Ensure full opacity
                        // child.material.color = 0x00ffff;
                    } else {
                        console.log('No material found for mesh:', child.name);
                        child.material = new THREE.MeshLambertMaterial({ color: 0x00ff00 });
                    }
                   
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            console.log("All mesh names:", meshNames.join(", "));  // Print comma-separated list

            const box = new THREE.Box3().setFromObject(gltf.scene);
            const center = new THREE.Vector3();
            box.getCenter(center);
           
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
            console.log('Loading progress:', (xhr.loaded / xhr.total * 100).toFixed(2) + '%');
        },
        function(error) {
            console.error('Error loading model:', error);
        }
    );

    labelRenderer.setSize(window.innerWidth - 300, window.innerHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0';
    labelRenderer.domElement.style.pointerEvents = 'none';
    document.getElementById('scene-container').appendChild(labelRenderer.domElement);
    //renderer.localClippingEnabled = true; // Enable local clipping
    //clippingPlane = new THREE.Plane(new THREE.Vector3(30, -10, 0), 0); // Adjust position as needed
    //planeHelper = new THREE.PlaneHelper(clippingPlane, 5, 0xff0000); // size and color for visibility
    //scene.add(planeHelper);
    //planeHelper.visible = clippingEnabled;
    //setupClippingPlaneGUI();

    // toggleClippingPlane();
    animate();
   
}

function setupClippingPlaneGUI() {
    const gui = new GUI();
    const clippingPlaneFolder = gui.addFolder('Clipping Plane');

    // Position controls
    clippingPlaneFolder.add(clippingPlane, 'constant', -10, 10).name('Offset')
        .onChange(() => console.log(`Clipping Plane Offset: ${clippingPlane.constant}`));

    // Rotation controls
    const planeRotation = {
        rotationX: clippingPlane.normal.x,
        rotationY: clippingPlane.normal.y,
        rotationZ: clippingPlane.normal.z,
    };

    clippingPlaneFolder.add(planeRotation, 'rotationX', -1, 1).step(0.01)
        .name('Rotation X')
        .onChange((value) => {
            clippingPlane.normal.x = value;
            console.log(`Clipping Plane Rotation X: ${value}`);
        });

    clippingPlaneFolder.add(planeRotation, 'rotationY', -1, 1).step(0.01)
        .name('Rotation Y')
        .onChange((value) => {
            clippingPlane.normal.y = value;
            console.log(`Clipping Plane Rotation Y: ${value}`);
        });

    clippingPlaneFolder.add(planeRotation, 'rotationZ', -1, 1).step(0.01)
        .name('Rotation Z')
        .onChange((value) => {
            clippingPlane.normal.z = value;
            console.log(`Clipping Plane Rotation Z: ${value}`);
        });

    clippingPlaneFolder.open();
}


function animate() {
    requestAnimationFrame(animate);
    controls.update();
    composer.render();
    labelRenderer.render(scene, camera);
    // highlightObject('laserCutter','#00ffff');
}

window.addEventListener('resize', () => {
    const container = document.getElementById('scene-container');
    const width = window.innerWidth - 300;
    const height = window.innerHeight;
   
    // Update camera aspect ratio
    const aspect = width / height;
    const frustumSize = 10;
    camera.left = -frustumSize * aspect / 2;
    camera.right = frustumSize * aspect / 2;
    camera.top = frustumSize / 2;
    camera.bottom = -frustumSize / 2;
    camera.updateProjectionMatrix();
   
    // Update renderer and composer
    renderer.setSize(width, height);
    composer.setSize(width, height);
    saoPass.setSize(width, height);
   
    // Update FXAA resolution
    const pixelRatio = renderer.getPixelRatio();
    fxaaPass.material.uniforms['resolution'].value.x = 1 / (width * pixelRatio);
    fxaaPass.material.uniforms['resolution'].value.y = 1 / (height * pixelRatio);
});

// // Keyboard controls
// window.addEventListener('keydown', function(event) {
//     switch(event.key) {
//         case 'd':
//             ssaoPass.output = (ssaoPass.output + 1) % 4;
//             console.log('SSAO Output Mode:', ssaoPass.output);
//             break;
//         case 'ArrowUp':
//             ssaoPass.intensity = Math.min((ssaoPass.intensity + 0.1), 10);
//             console.log('SSAO Intensity:', ssaoPass.intensity);
//             break;
//         case 'ArrowDown':
//             ssaoPass.intensity = Math.max((ssaoPass.intensity - 0.1), 0);
//             console.log('SSAO Intensity:', ssaoPass.intensity);
//             break;
//         case 'ArrowLeft':
//             ssaoPass.kernelRadius = Math.max((ssaoPass.kernelRadius - 0.01), 0.01);
//             console.log('Kernel Radius:', ssaoPass.kernelRadius);
//             break;
//         case 'ArrowRight':
//             ssaoPass.kernelRadius = Math.min((ssaoPass.kernelRadius + 0.01), 8);
//             console.log('Kernel Radius:', ssaoPass.kernelRadius);
//             break;
//     }
// });

function createLabelForObject(meshName, labelText) {
    const mesh = meshes[meshName];
    if (!mesh) return;
   
    // Create HTML label
    const labelDiv = document.createElement('div');
    labelDiv.className = 'mesh-label';
    labelDiv.textContent = labelText;
   
    // Create Three.js label
    const label = new CSS2DObject(labelDiv);
   
    // Get mesh bounds and position label higher above it
    const boundingBox = new THREE.Box3().setFromObject(mesh);
    const center = new THREE.Vector3();
    boundingBox.getCenter(center);
    const height = boundingBox.max.y - boundingBox.min.y;
   
    // Position label higher above the mesh (2x the height of the object)
    label.position.copy(center);
    label.position.y = boundingBox.max.y + (height) + 1.75;
   
    // Create and position arrow
    const arrowGeometry = new THREE.ConeGeometry(0.1, 0.3, 8);
    const arrowMaterial = new THREE.MeshBasicMaterial({
        color: 0x0,
        opacity: 0.8,
        transparent: true
    });
    const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
   
    // Adjust arrow position
    const arrowPosition = new THREE.Vector3(
        center.x,
        boundingBox.max.y + (height * 0.3),
        center.z
    );
    arrow.position.copy(arrowPosition);
    arrow.rotation.x = Math.PI;
   
    // Create curved line
    const points = [
        label.position,
        arrowPosition,
        center // Add a third point to create a bent line
    ];
    const curve = new THREE.CatmullRomCurve3(points);
    const linePoints = curve.getPoints(50);
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);
    const lineMaterial = new THREE.LineBasicMaterial({
        color: 0x0,
        opacity: 0.8,
        transparent: true
    });
    const line = new THREE.Line(lineGeometry, lineMaterial);
   
    // Group arrow and line
    const group = new THREE.Group();
    group.add(arrow);
    group.add(line);
    group.add(label);
   
    // Store for later removal
    labels.set(meshName, group);
   
    scene.add(group);
}
let clippingPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0); // Define a clipping plane
let clippingEnabled = true; // State to track if clipping is enabled
let planeHelper; // Declare a variable for the plane helper

function toggleClippingPlane() {
    clippingEnabled = !clippingEnabled;
    renderer.clippingPlanes = clippingEnabled ? [clippingPlane] : [];
    planeHelper.visible = clippingEnabled; // Toggle the visibility of the plane helper
    console.log(`Clipping plane ${clippingEnabled ? 'enabled' : 'disabled'}`);
}

function removeLabelFromObject(meshName) {
    const label = labels.get(meshName);
    if (label) {
        scene.remove(label);
        labels.delete(meshName);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    let isRecording = false;
    const microphoneIcon = document.getElementById('microphone-icon');
    const iconElement = microphoneIcon.querySelector('i');

microphoneIcon.addEventListener('click', async function() {
    if (!isRecording) {
        // Start recording
        isRecording = true;
        microphoneIcon.style.backgroundColor = 'red';
        iconElement.classList.remove('fa-microphone');
        iconElement.classList.add('fa-stop');

        try {
            // Request microphone access and start recording
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            const audioChunks = [];

            mediaRecorder.ondataavailable = event => {
                audioChunks.push(event.data);
            };

            mediaRecorder.start();

            // Store mediaRecorder for later use
            microphoneIcon.mediaRecorder = mediaRecorder;
            microphoneIcon.audioChunks = audioChunks;

        } catch (error) {
            console.error("Error accessing the microphone:", error);
        }

    } else {
        // Stop recording
        isRecording = false;
        microphoneIcon.style.backgroundColor = '#248bf5';
        iconElement.classList.remove('fa-stop');
        iconElement.classList.add('fa-hourglass');
        microphoneIcon.classList.add('processing'); // Add processing class
        microphoneIcon.disabled = true; // Disable the icon during processing

        // Stop recording logic here
        const mediaRecorder = microphoneIcon.mediaRecorder;
        mediaRecorder.stop();

        mediaRecorder.onstop = async () => {
            try {
                const audioBlob = new Blob(microphoneIcon.audioChunks, { type: 'audio/wav' });
                const formData = new FormData();
                formData.append('file', audioBlob, 'audio.wav');

                // Send audio to Whisper for transcription
                const whisperResponse = await fetch('/api/whisper', {
                    method: 'POST',
                    body: formData
                });

                if (!whisperResponse.ok) {
                    throw new Error('Error in Whisper API response');
                }

                const whisperData = await whisperResponse.json();
                const transcript = whisperData.transcript;

                // Send transcript to the chat endpoint
                const chatResponse = await fetch('/api/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        message: transcript,
                        thread_id: currentThreadId
                    })
                });

                if (!chatResponse.ok) {
                    throw new Error('Error in Chat API response');
                }

                const chatData = await chatResponse.json();
                handleAssistantResponse(chatData);

            } catch (error) {
                console.error("Error processing audio:", error);
            } finally {
                iconElement.classList.remove('fa-hourglass');
                iconElement.classList.add('fa-microphone');
                microphoneIcon.classList.remove('processing'); // Remove processing class
                microphoneIcon.disabled = false; // Re-enable the icon after processing
            }
        };
    }
});
});


init();
