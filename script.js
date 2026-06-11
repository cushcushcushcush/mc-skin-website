import * as skinview3d from "https://cdn.jsdelivr.net/npm/skinview3d@3.4.2/+esm";

console.log("Skin validation, saved preferences, model drawer and 3D viewer script loaded");

const upload = document.getElementById("skinUpload");
const preview = document.getElementById("skinPreview");
const statusText = document.getElementById("uploadStatus");
const emptyPreviewText = document.getElementById("emptyPreviewText");

const fileNameText = document.getElementById("fileName");
const fileDimensionsText = document.getElementById("fileDimensions");
const skinTypeText = document.getElementById("skinType");
const modelChoiceText = document.getElementById("modelChoice");

const skin3dCanvas = document.getElementById("skin3dCanvas");
const viewerStatus = document.getElementById("viewerStatus");

const toggleRotationBtn = document.getElementById("toggleRotationBtn");
const toggleAnimationBtn = document.getElementById("toggleAnimationBtn");
const resetPreferencesBtn = document.getElementById("resetPreferencesBtn");
const animationSpeedSlider = document.getElementById("animationSpeed");
const speedValue = document.getElementById("speedValue");
const prefsStatus = document.getElementById("prefsStatus");

const drawerOverlay = document.getElementById("drawerOverlay");
const modelDrawer = document.getElementById("modelDrawer");
const closeDrawerBtn = document.getElementById("closeDrawerBtn");
const applyModelBtn = document.getElementById("applyModelBtn");
const modelChoiceSummary = document.getElementById("modelChoiceSummary");
const modelOptionButtons = document.querySelectorAll("[data-model-choice]");

const preferencesKey = "mcSkinWorkshopViewerPreferences";

const defaultPreferences = {
    modelChoice: "auto-detect",
    autoRotate: true,
    walkPaused: false,
    walkSpeed: 0.7
};

let viewerPreferences = loadViewerPreferences();
let skinViewer = null;
let pendingSkinDataUrl = null;
let pendingModelChoice = viewerPreferences.modelChoice;

setupSkinViewer();
setupViewerControls();
setupModelDrawer();
applyPreferencesToInterface();

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
                modelChoiceText.textContent = "None";
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

            pendingSkinDataUrl = event.target.result;
            selectModelChoice(viewerPreferences.modelChoice);
            modelChoiceText.textContent = "Waiting for choice";

            updateViewerStatus("Choose a model type to update the 3D viewer.", true);
            openModelDrawer();
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

        skinViewer.animation = new skinview3d.WalkingAnimation();

        if (skinViewer.controls) {
            skinViewer.controls.enableRotate = true;
            skinViewer.controls.enableZoom = true;
            skinViewer.controls.enablePan = false;
        }

        applyPreferencesToViewer();

        updateViewerStatus("3D viewer ready. Upload a skin to begin.", true);
    } catch (error) {
        console.error("3D viewer failed to start:", error);
        updateViewerStatus("3D viewer failed to start. Check the browser console.", false);
    }
}

function setupViewerControls() {
    toggleRotationBtn.addEventListener("click", function () {
        if (!skinViewer) return;

        viewerPreferences.autoRotate = !viewerPreferences.autoRotate;
        saveViewerPreferences();

        applyPreferencesToViewer();
        applyPreferencesToInterface();
        showPreferencesSavedMessage();
    });

    toggleAnimationBtn.addEventListener("click", function () {
        if (!skinViewer || !skinViewer.animation) return;

        viewerPreferences.walkPaused = !viewerPreferences.walkPaused;
        saveViewerPreferences();

        applyPreferencesToViewer();
        applyPreferencesToInterface();
        showPreferencesSavedMessage();
    });

    animationSpeedSlider.addEventListener("input", function () {
        const speed = Number(animationSpeedSlider.value);

        viewerPreferences.walkSpeed = speed;
        saveViewerPreferences();

        applyPreferencesToViewer();
        applyPreferencesToInterface();
        showPreferencesSavedMessage();
    });

    resetPreferencesBtn.addEventListener("click", function () {
        viewerPreferences = structuredClone(defaultPreferences);
        pendingModelChoice = viewerPreferences.modelChoice;

        saveViewerPreferences();

        applyPreferencesToViewer();
        applyPreferencesToInterface();
        selectModelChoice(viewerPreferences.modelChoice);

        showPreferencesSavedMessage("Preferences reset to defaults.");
    });
}

function setupModelDrawer() {
    modelOptionButtons.forEach(function (button) {
        button.addEventListener("click", function () {
            const choice = button.dataset.modelChoice;
            selectModelChoice(choice);
        });
    });

    applyModelBtn.addEventListener("click", async function () {
        if (!pendingSkinDataUrl) {
            updateViewerStatus("Upload a valid skin before choosing a model.", false);
            return;
        }

        viewerPreferences.modelChoice = pendingModelChoice;
        saveViewerPreferences();

        applyModelBtn.disabled = true;
        applyModelBtn.textContent = "Applying...";

        await loadSkinInto3DViewer(pendingSkinDataUrl, pendingModelChoice);

        applyModelBtn.disabled = false;
        applyModelBtn.textContent = "Apply Model";

        closeModelDrawer();
        applyPreferencesToInterface();
        showPreferencesSavedMessage();
    });

    closeDrawerBtn.addEventListener("click", closeModelDrawer);
    drawerOverlay.addEventListener("click", closeModelDrawer);
}

function selectModelChoice(choice) {
    pendingModelChoice = choice;

    modelOptionButtons.forEach(function (button) {
        if (button.dataset.modelChoice === choice) {
            button.classList.add("selected");
        } else {
            button.classList.remove("selected");
        }
    });

    modelChoiceSummary.textContent = getModelLabel(choice);
}

async function loadSkinInto3DViewer(skinDataUrl, modelChoice) {
    if (!skinViewer) {
        updateViewerStatus("3D viewer is not available.", false);
        return;
    }

    try {
        await skinViewer.loadSkin(skinDataUrl, {
            model: modelChoice
        });

        applyPreferencesToViewer();

        const detectedModel = getActiveViewerModel();

        if (modelChoice === "auto-detect") {
            const detectedLabel = detectedModel ? getModelLabel(detectedModel) : "Unknown";
            modelChoiceText.textContent = `Auto-detect (${detectedLabel})`;
            updateViewerStatus(`3D skin loaded with auto-detect: ${detectedLabel}.`, true);
        } else {
            modelChoiceText.textContent = getModelLabel(modelChoice);
            updateViewerStatus(`3D skin loaded as ${getModelLabel(modelChoice)}.`, true);
        }
    } catch (error) {
        console.error("Could not load skin into 3D viewer:", error);
        updateViewerStatus("Could not load this skin into the 3D viewer.", false);
    }
}

function applyPreferencesToViewer() {
    if (!skinViewer) return;

    skinViewer.autoRotate = viewerPreferences.autoRotate;

    if (skinViewer.animation) {
        skinViewer.animation.paused = viewerPreferences.walkPaused;
        skinViewer.animation.speed = viewerPreferences.walkSpeed;
    }
}

function applyPreferencesToInterface() {
    toggleRotationBtn.textContent = viewerPreferences.autoRotate ? "Pause Rotation" : "Resume Rotation";
    toggleAnimationBtn.textContent = viewerPreferences.walkPaused ? "Resume Walk" : "Pause Walk";

    animationSpeedSlider.value = viewerPreferences.walkSpeed;
    speedValue.textContent = Number(viewerPreferences.walkSpeed).toFixed(1);

    selectModelChoice(viewerPreferences.modelChoice);
}

function loadViewerPreferences() {
    try {
        const savedPreferences = localStorage.getItem(preferencesKey);

        if (!savedPreferences) {
            return structuredClone(defaultPreferences);
        }

        const parsedPreferences = JSON.parse(savedPreferences);

        return {
            ...defaultPreferences,
            ...parsedPreferences
        };
    } catch (error) {
        console.warn("Could not load viewer preferences:", error);
        return structuredClone(defaultPreferences);
    }
}

function saveViewerPreferences() {
    try {
        localStorage.setItem(preferencesKey, JSON.stringify(viewerPreferences));
    } catch (error) {
        console.warn("Could not save viewer preferences:", error);
    }
}

function showPreferencesSavedMessage(customMessage = "Viewer preferences saved on this browser.") {
    if (!prefsStatus) return;

    prefsStatus.textContent = customMessage;

    window.clearTimeout(showPreferencesSavedMessage.timeoutId);

    showPreferencesSavedMessage.timeoutId = window.setTimeout(function () {
        prefsStatus.textContent = "Viewer preferences save automatically on this browser.";
    }, 1800);
}

function getActiveViewerModel() {
    try {
        return skinViewer.playerObject.skin.modelType;
    } catch (error) {
        console.warn("Could not read active model type:", error);
        return null;
    }
}

function getModelLabel(modelChoice) {
    if (modelChoice === "default") return "Classic";
    if (modelChoice === "slim") return "Slim";
    if (modelChoice === "auto-detect") return "Auto-detect";

    return "Unknown";
}

function openModelDrawer() {
    drawerOverlay.classList.add("open");
    modelDrawer.classList.add("open");
}

function closeModelDrawer() {
    drawerOverlay.classList.remove("open");
    modelDrawer.classList.remove("open");
}

function resetPreview() {
    preview.src = "";
    preview.style.display = "none";

    emptyPreviewText.style.display = "block";

    fileNameText.textContent = "None";
    fileDimensionsText.textContent = "None";
    skinTypeText.textContent = "None";
    modelChoiceText.textContent = "None";

    pendingSkinDataUrl = null;
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