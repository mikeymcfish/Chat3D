import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { SAOPass } from 'three/addons/postprocessing/SAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

import { GUI } from 'three/addons/libs/lil-gui.module.min.js';


let scene, camera, renderer, controls, meshes = {};
let composer, ssaoPass, saoPass, renderPass, fxaaPass;


/// TO LOOK AT: Decals, LOD, toon material, FXAA, GTAO, SSAA, Outline pass, SAO, bloom pass

// Previous export functions remain unchanged
export function highlightObject(meshName, color = '#FF0000') {
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
        highlightMaterial.emissiveIntensity = 0.5;
        mesh.material = highlightMaterial;
    } catch (error) {
        console.error('Error highlighting mesh:', error);
    }
}

export function resetHighlight(meshName) {
    const mesh = meshes[meshName];
    if (mesh && mesh.userData.originalMaterial) {
        mesh.material = mesh.userData.originalMaterial;
    }
}

export function zoomToObject(meshName) {
    // Ensure the function is correctly defined and exported
    // console.log('Attempting to zoom to:', meshName);
    // const mesh = meshes[meshName];
    // console.log(meshes);
    // if (mesh) {
    //     console.log('Found mesh to zoom to:', meshName);
    //     const box = new THREE.Box3().setFromObject(mesh);
    //     const center = new THREE.Vector3();
    //     box.getCenter(center);
    //     camera.position.set(center.x, center.y, center.z + 5);
    //     camera.lookAt(center);
    //     controls.target.copy(center);
    //     controls.update();
    // } else {
    //     console.log('Mesh not found for zooming:', meshName);
    //     console.log('Available meshes:', Object.keys(meshes));
    // }
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
        powerPreference: 'high-performance'
    });
    renderer.setSize(window.innerWidth - 300, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const container = document.getElementById('scene-container');
    container.appendChild(renderer.domElement);

    // Setup post-processing
    composer = new EffectComposer(renderer);
    
    const renderPass = new RenderPass(scene, camera);


    composer.addPass(renderPass);
    saoPass = new SAOPass( scene, camera );
    saoPass.params.saoBias = 0.232;
    saoPass.params.saoIntensity = 0.075;
    saoPass.params.saoScale = .9;
    saoPass.params.saoKernelRadius = 40.0;
    saoPass.params.saoMinResolution = 0.0;
    saoPass.params.saoBlur = true;
    composer.addPass( saoPass );
    const outputPass = new OutputPass();
    composer.addPass( outputPass );
    fxaaPass = new ShaderPass( FXAAShader );
    composer.addPass( fxaaPass );
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
            
            gltf.scene.traverse(function(child) {
                if (child.isMesh) {
                    meshes[child.name] = child;
                    
                    if (child.material) {
                        child.material.needsUpdate = true;
                        child.material.metalness = 0.2;
                        child.material.roughness = 0.8;
                        // child.material.color = 0x00ffff;
                    } else {
                        console.log('No material found for mesh:', child.name);
                        child.material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
                    }
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

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

    animate();
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    composer.render();
    // renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
        const width = window.innerWidth - 300;
        const height = window.innerHeight;
        renderer.setSize(width, height);
        composer.setSize(width, height);
        ssaoPass.setSize(width, height);
        const pixelRatio = renderer.getPixelRatio();
        fxaaPass.material.uniforms[ 'resolution' ].value.x = 1 / ( container.offsetWidth * pixelRatio );
		fxaaPass.material.uniforms[ 'resolution' ].value.y = 1 / ( container.offsetHeight * pixelRatio );
    });

// Keyboard controls
window.addEventListener('keydown', function(event) {
    switch(event.key) {
        case 'd':
            ssaoPass.output = (ssaoPass.output + 1) % 4;
            console.log('SSAO Output Mode:', ssaoPass.output);
            break;
        case 'ArrowUp':
            ssaoPass.intensity = Math.min((ssaoPass.intensity + 0.1), 10);
            console.log('SSAO Intensity:', ssaoPass.intensity);
            break;
        case 'ArrowDown':
            ssaoPass.intensity = Math.max((ssaoPass.intensity - 0.1), 0);
            console.log('SSAO Intensity:', ssaoPass.intensity);
            break;
        case 'ArrowLeft':
            ssaoPass.kernelRadius = Math.max((ssaoPass.kernelRadius - 0.01), 0.01);
            console.log('Kernel Radius:', ssaoPass.kernelRadius);
            break;
        case 'ArrowRight':
            ssaoPass.kernelRadius = Math.min((ssaoPass.kernelRadius + 0.01), 8);
            console.log('Kernel Radius:', ssaoPass.kernelRadius);
            break;
    }
});

init();