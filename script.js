import * as skinview3d from "https://cdn.jsdelivr.net/npm/skinview3d@3.4.2/+esm";

console.log("Skin validation and 3D viewer script loaded");

const upload = document.getElementById("skinUpload");
const preview = document.getElementById("skinPreview");
const statusText = document.getElementById("uploadStatus");
const emptyPreviewText = document.getElementById("emptyPreviewText");

const fileNameText = document.getElementById("fileName");
const fileDimensionsText = document.getElementById("fileDimensions");
const skinTypeText = document.getElementById("skinType");

const skin3dCanvas = document.getElementById("skin3dCanvas");
const viewerStatus = document.getElementById("viewerStatus");

const toggleRotationBtn = document.getElementById("toggleRotationBtn");
const toggleAnimationBtn = document.getElementById("toggleAnimationBtn");
const animationSpeedSlider = document.getElementById("animationSpeed");
const speedValue = document.getElementById("speedValue");

let skinViewer = null;

setupSkinViewer();

toggleRotationBtn.addEventListener("click", function () {
    if (!skinViewer) return;

    skinViewer.autoRotate = !skinViewer.autoRotate;

    if (skinViewer.autoRotate) {
        toggleRotationBtn.textContent = "Pause Rotation";
    } else {
        toggleRotationBtn.textContent = "Resume Rotation";
    }
});

toggleAnimationBtn.addEventListener("click", function () {
    if (!skinViewer || !skinViewer.animation) return;

    skinViewer.animation.paused = !skinViewer.animation.paused;

    if (skinViewer.animation.paused) {
        toggleAnimationBtn.textContent = "Resume Walk";
    } else {
        toggleAnimationBtn.textContent = "Pause Walk";
    }
});

animationSpeedSlider.addEventListener("input", function () {
    const speed = Number(animationSpeedSlider.value);

    speedValue.textContent = speed.toFixed(1);

    if (!skinViewer || !skinViewer.animation) return;

    skinViewer.animation.speed = speed;
});

upload.addEventListener("change", function () {
    const file = this.files[0];

    resetPreview();

    if (!file) {
        showError("No file selected.");
        updateViewerStatus("Waiting for a valid skin.", false);
        return;
    }

    console.log("Uploaded file:", file.name, file.type);

    const fileName = file.name.toLowerCase();

    if (!fileName.endsWith(".png")) {
        showError("Invalid file type. Minecraft skins must be PNG files.");
        fileNameText.textContent = file.name;
        updateViewerStatus("3D viewer needs a valid PNG skin.", false);
        return;
    }

    if (file.type && file.type !== "image/png") {
        showError("Invalid file type. Please upload a real PNG image.");
        fileNameText.textContent = file.name;
        updateViewerStatus("3D viewer needs a real PNG image.", false);
        return;
    }

    const reader = new FileReader();

    reader.onload = function (event) {
        const image = new Image();

        image.onload = function () {
            const width = image.width;
            const height = image.height;

            console.log("Image size:", width, height);

            const isModernSkin = width === 64 && height === 64;
            const isLegacySkin = width === 64 && height === 32;

            fileNameText.textContent = file.name;
            fileDimensionsText.textContent = `${width}x${height}`;

            if (!isModernSkin && !isLegacySkin) {
                showError(`Invalid skin size: ${width}x${height}. Please upload a 64x64 or 64x32 Minecraft skin.`);
                skinTypeText.textContent = "Invalid";
                updateViewerStatus("3D viewer needs a valid Minecraft skin size.", false);
                return;
            }

            preview.src = event.target.result;
            preview.style.display = "block";
            emptyPreviewText.style.display = "none";

            if (isModernSkin) {
                skinTypeText.textContent = "Modern 64x64";
                showSuccess("Valid 64x64 Minecraft skin loaded.");
            } else {
                skinTypeText.textContent = "Legacy 64x32";
                showSuccess("Valid legacy 64x32 Minecraft skin loaded.");
            }

            loadSkinInto3DViewer(event.target.result);
        };

        image.onerror = function () {
            showError("This file could not be read as an image.");
            fileNameText.textContent = file.name;
            updateViewerStatus("This file could not be loaded into the 3D viewer.", false);
        };

        image.src = event.target.result;
    };

    reader.readAsDataURL(file);
});

function setupSkinViewer() {
    try {
        skinViewer = new skinview3d.SkinViewer({
            canvas: skin3dCanvas,
            width: 300,
            height: 400
        });

        skinViewer.background = 0x151515;
        skinViewer.fov = 50;
        skinViewer.zoom = 0.85;
        skinViewer.autoRotate = true;

        skinViewer.animation = new skinview3d.WalkingAnimation();
        skinViewer.animation.speed = 0.7;

        if (skinViewer.controls) {
            skinViewer.controls.enableRotate = true;
            skinViewer.controls.enableZoom = true;
            skinViewer.controls.enablePan = false;
        }

        updateViewerStatus("3D viewer ready. Upload a skin to begin.", true);
    } catch (error) {
        console.error("3D viewer failed to start:", error);
        updateViewerStatus("3D viewer failed to start. Check the browser console.", false);
    }
}

async function loadSkinInto3DViewer(skinDataUrl) {
    if (!skinViewer) {
        updateViewerStatus("3D viewer is not available.", false);
        return;
    }

    try {
        await skinViewer.loadSkin(skinDataUrl);
        skinViewer.autoRotate = true;

        updateViewerStatus("3D skin loaded successfully.", true);
    } catch (error) {
        console.error("Could not load skin into 3D viewer:", error);
        updateViewerStatus("Could not load this skin into the 3D viewer.", false);
    }
}

function resetPreview() {
    preview.src = "";
    preview.style.display = "none";

    emptyPreviewText.style.display = "block";

    fileNameText.textContent = "None";
    fileDimensionsText.textContent = "None";
    skinTypeText.textContent = "None";
}

function showError(message) {
    statusText.textContent = message;
    statusText.className = "error";
}

function showSuccess(message) {
    statusText.textContent = message;
    statusText.className = "success";
}

function updateViewerStatus(message, isSuccess) {
    viewerStatus.textContent = message;
    viewerStatus.className = isSuccess ? "success" : "error";
}