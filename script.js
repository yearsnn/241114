document.addEventListener("DOMContentLoaded", function () {
    let video = document.getElementById("video");
    let captureButton1 = document.getElementById("captureButton1");
    let captureButton2 = document.getElementById("captureButton2");
    let cameraContainer = document.getElementById("camera-container");
    let captureScreen = document.getElementById("captureScreen");
    let threejsContainer = document.getElementById("threejs-container");


    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            video.srcObject = stream;
        })
        .catch(err => {
            console.error("카메라 접근 오류:", err);
        });

    
    captureButton1.addEventListener("click", () => {
        captureImage(1);
        captureButton1.style.display = 'none';  
        captureButton2.style.display = 'block';  
        captureScreen.style.display = 'flex';  
    });


    captureButton2.addEventListener("click", () => {
        captureImage(2);
        captureScreen.style.display = 'none';
        threejsContainer.style.display = 'block';  
    });
});

let img1, img2;
let pixelsData = [];
let scene, camera, renderer, controls;
let cubes = [];

async function captureImage(imgNumber) {
    let canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    let context = canvas.getContext("2d");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    let img = new Image();
    img.src = canvas.toDataURL("image/png");
    img.onload = function () {
        if (imgNumber === 1) {
            img1 = img;
            captureButton1.disabled = true;
            captureButton1.innerText = "첫 번째 촬영 완료";
        } else if (imgNumber === 2) {
            img2 = img;
            captureButton2.disabled = true;
            captureButton2.innerText = "두 번째 촬영 완료";
            processImages();
        }
    };
}

async function processImages() {
    if (!img1 || !img2) {
        console.error("두 이미지를 모두 캡처해야 합니다.");
        return;
    }


    const net = await bodyPix.load();
    const segmentation1 = await net.segmentPerson(img1);
    const segmentation2 = await net.segmentPerson(img2);

    let canvas1 = document.createElement("canvas");
    canvas1.width = img1.width;
    canvas1.height = img1.height;
    let ctx1 = canvas1.getContext("2d");
    ctx1.drawImage(img1, 0, 0);

    let canvas2 = document.createElement("canvas");
    canvas2.width = img2.width;
    canvas2.height = img2.height;
    let ctx2 = canvas2.getContext("2d");
    ctx2.drawImage(img2, 0, 0);

    // 배경 제거
    removeBackground(ctx1, canvas1, segmentation1);
    removeBackground(ctx2, canvas2, segmentation2);

    pixelsData = [];
    let pixelSize = 3;
    let pixelSpacing = 30; 

    // 픽셀화 및 z 위치 계산
    for (let x = 0; x < img1.width; x += pixelSize) {
        for (let y = 0; y < img1.height; y += pixelSize) {
            let pixel1 = ctx1.getImageData(x, y, pixelSize, pixelSize).data;
            let pixel2 = ctx2.getImageData(x, y, pixelSize, pixelSize).data;

            let depth = map(pixel1[0], 0, 255, -100, 100);
            pixelsData.push({
                x: (x - img1.width / 2) * 1.5,  
                y: (-(y - img1.height / 2)) * 1.5, 
                z: depth,
                color1: new THREE.Color(`rgb(${pixel1[0]}, ${pixel1[1]}, ${pixel1[2]})`),
                color2: new THREE.Color(`rgb(${pixel2[0]}, ${pixel2[1]}, ${pixel2[2]})`)
            });
        }
    }

    initThreeJS();
}


function removeBackground(ctx, canvas, segmentation) {
    const width = canvas.width;
    const height = canvas.height;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        if (segmentation.data[i / 4] === 0) {  
            data[i] = 255;  
            data[i + 1] = 255; 
            data[i + 2] = 255; 
            data[i + 3] = 0;  
        }
    }

    ctx.putImageData(imageData, 0, 0);
}

function initThreeJS() {

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 500;

    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight); 
    document.getElementById('threejs-container').appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);


    pixelsData.forEach(pixel => {
        let geometry = new THREE.BoxGeometry(5, 5, 5); 
        let material = new THREE.MeshBasicMaterial({ color: pixel.color1 });
        let cube = new THREE.Mesh(geometry, material);
        cube.position.set(pixel.x, pixel.y, pixel.z);
        cubes.push({ mesh: cube, color1: pixel.color1, color2: pixel.color2 });
        scene.add(cube);
    });

    animate();


    window.addEventListener('resize', onWindowResize, false);
}

function onWindowResize() {
  
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
}

function animate() {
    requestAnimationFrame(animate);

    cubes.forEach(cubeObj => {
        let angle = Math.abs(camera.rotation.y) % Math.PI;
        cubeObj.mesh.material.color = angle > Math.PI / 2 ? cubeObj.color2 : cubeObj.color1;
    });

    controls.update();
    renderer.render(scene, camera);
}

function map(value, start1, stop1, start2, stop2) {
    return start2 + (stop2 - start2) * (value - start1) / (stop1 - start1);
}
