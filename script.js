import { CustomSkinViewer, WalkingAnimation } from "./custom-skin-viewer.js";

console.log("Skin validation, saved preferences, model drawer and custom 3D viewer script loaded");

const upload = document.getElementById("skinUpload");
const statusText = document.getElementById("uploadStatus");

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

const toggleOuterLayerBtn = document.getElementById("toggleOuterLayerBtn");

const toolButtons = document.querySelectorAll("[data-tool]");
const activeToolStatus = document.getElementById("activeToolStatus");
const toolMenu = document.getElementById("toolMenu");
const toolMenuTitle = document.getElementById("toolMenuTitle");
const toolMenuPath = document.getElementById("toolMenuPath");
const toolMenuOptions = document.getElementById("toolMenuOptions");
const toolMenuBackBtn = document.getElementById("toolMenuBackBtn");
const toolMenuCloseBtn = document.getElementById("toolMenuCloseBtn");

const selectedColourInput = document.getElementById("selectedColour");
const selectedHexInput = document.getElementById("selectedHex");
const brushSizeButtons = document.querySelectorAll("[data-brush-size]");
const recentColoursContainer = document.getElementById("recentColours");
const skinPaletteContainer = document.getElementById("skinPalette");
const toolSettingsStatus = document.getElementById("toolSettingsStatus");

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
let outerLayerVisible = true;
let activeTool = null;
let toolMenuStack = [];

let editorSettings = {
    selectedColour: "#7CFF9B",
    brushSize: 1,
    recentColours: ["#7CFF9B"],
    skinPalette: []
};

setupSkinViewer();
setupViewerControls();
setupModelDrawer();
setupLayerControls();
setupEditorTools();
setupEditorSettings();
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

            generateSkinPalette(image);

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
        skinViewer = new CustomSkinViewer({
            canvas: skin3dCanvas,
            width: 520,
            height: 650
        });

        skinViewer.background = 0x1F2233;
        skinViewer.fov = 50;
        skinViewer.zoom = 0.85;

        skinViewer.animation = new WalkingAnimation();

        if (skinViewer.controls) {
            skinViewer.controls.enableRotate = true;
            skinViewer.controls.enableZoom = true;
            skinViewer.controls.enablePan = true;
        }

        applyPreferencesToViewer();
        setupModelClickDetection();

        updateViewerStatus("3D viewer ready. Upload a skin to begin.", true);
    } catch (error) {
        console.error("3D viewer failed to start:", error);
        updateViewerStatus("3D viewer failed to start. Check the browser console.", false);
    }
}

function setupModelClickDetection() {
    if (!skinViewer) return;

    skinViewer.onModelClick = function (hitInfo) {
        const toolLabel = activeTool ? getToolLabel(activeTool) : "No tool";
        const pixelText = hitInfo.skinPixel
            ? ` | Pixel: ${hitInfo.skinPixel.x}, ${hitInfo.skinPixel.y}`
            : "";

        activeToolStatus.textContent =
            `${toolLabel} | Hit: ${hitInfo.part} ${hitInfo.face} (${hitInfo.layer})${pixelText}`;

        console.log("3D model hit:", hitInfo);
    };
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
        applyLayerVisibilityToViewer();

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
        if (skinViewer && skinViewer.modelType) {
            return skinViewer.modelType;
        }

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

function setupLayerControls() {
    toggleOuterLayerBtn.addEventListener("click", function () {
        outerLayerVisible = !outerLayerVisible;

        applyLayerVisibilityToViewer();
        updateLayerButton();

        if (outerLayerVisible) {
            updateViewerStatus("Secondary layer visible.", true);
        } else {
            updateViewerStatus("Secondary layer hidden.", true);
        }
    });

    updateLayerButton();
}

function applyLayerVisibilityToViewer() {
    if (!skinViewer) return;

    if (typeof skinViewer.setOuterLayerVisible === "function") {
        skinViewer.setOuterLayerVisible(outerLayerVisible);
        return;
    }

    if (!skinViewer.playerObject || !skinViewer.playerObject.skin) return;

    const skin = skinViewer.playerObject.skin;

    const outerLayers = [
        skin.head.outerLayer,
        skin.body.outerLayer,
        skin.leftArm.outerLayer,
        skin.rightArm.outerLayer,
        skin.leftLeg.outerLayer,
        skin.rightLeg.outerLayer
    ];

    outerLayers.forEach(function (layer) {
        if (layer) {
            layer.visible = outerLayerVisible;
        }
    });
}

function updateLayerButton() {
    toggleOuterLayerBtn.textContent = outerLayerVisible
        ? "Secondary Layer: On"
        : "Secondary Layer: Off";
}

function rgbToHex(red, green, blue) {
    return "#" + [red, green, blue]
        .map(function (value) {
            return value.toString(16).padStart(2, "0");
        })
        .join("")
        .toUpperCase();
}

const editorToolMenus = {
    bucket: {
        title: "Bucket",
        path: "Bucket",
        description: "Choose how the fill tool should behave.",
        options: [
            {
                label: "Connected Fill",
                description: "Fill pixels connected to the clicked pixel."
            },
            {
                label: "Replace Colour",
                description: "Replace matching colours across the selected area."
            },
            {
                label: "Fill Selected Part",
                description: "Fill a chosen body part when selection tools exist."
            }
        ]
    },

    splice: {
        title: "Splice",
        path: "Splice",
        description: "Choose a skin segment to work with.",
        options: [
            {
                label: "Head",
                description: "Select the head texture regions."
            },
            {
                label: "Body",
                description: "Select the torso texture regions."
            },
            {
                label: "Left Arm",
                description: "Select the left arm texture regions."
            },
            {
                label: "Right Arm",
                description: "Select the right arm texture regions."
            },
            {
                label: "Left Leg",
                description: "Select the left leg texture regions."
            },
            {
                label: "Right Leg",
                description: "Select the right leg texture regions."
            },
            {
                label: "Secondary Layer",
                description: "Select the outer layer regions."
            },
            {
                label: "Custom Selection",
                description: "Manual selection mode for advanced splicing."
            }
        ]
    },

    colourShade: {
        title: "Colour & Shade",
        path: "Colour & Shade",
        description: "Choose what part of the skin should be adjusted.",
        options: [
            {
                label: "Whole Skin",
                description: "Adjust the entire skin."
            },
            {
                label: "Selected Body Part",
                description: "Choose a body part to recolour or shade.",
                submenu: {
                    title: "Choose Body Part",
                    path: "Colour & Shade > Body Part",
                    description: "Pick which part should receive the adjustment.",
                    options: [
                        {
                            label: "Head",
                            description: "Apply changes to the head."
                        },
                        {
                            label: "Body",
                            description: "Apply changes to the torso."
                        },
                        {
                            label: "Left Arm",
                            description: "Apply changes to the left arm."
                        },
                        {
                            label: "Right Arm",
                            description: "Apply changes to the right arm."
                        },
                        {
                            label: "Left Leg",
                            description: "Apply changes to the left leg."
                        },
                        {
                            label: "Right Leg",
                            description: "Apply changes to the right leg."
                        }
                    ]
                }
            },
            {
                label: "Current Colour Range",
                description: "Adjust pixels similar to the chosen colour."
            },
            {
                label: "Secondary Layer Only",
                description: "Adjust only the outer layer pixels."
            }
        ]
    }
};

function setupEditorTools() {
    toolButtons.forEach(function (button) {
        button.addEventListener("click", function () {
            const toolName = button.dataset.tool;

            selectEditorTool(toolName);
        });
    });

    toolMenuCloseBtn.addEventListener("click", closeToolMenu);

    toolMenuBackBtn.addEventListener("click", function () {
        if (toolMenuStack.length <= 1) return;

        toolMenuStack.pop();
        renderToolMenu();
    });

    closeToolMenu();
}

function selectEditorTool(toolName) {
    activeTool = toolName;
    updateToolSettingsStatus();

    toolButtons.forEach(function (button) {
        if (button.dataset.tool === toolName) {
            button.classList.add("active");
        } else {
            button.classList.remove("active");
        }
    });

    const menu = editorToolMenus[toolName];

    if (menu) {
        activeToolStatus.textContent = `${getToolLabel(toolName)} selected. Choose an option.`;
        openToolMenu(menu);
        return;
    }

    closeToolMenu();

    if (toolName === "undo" || toolName === "redo") {
        activeToolStatus.textContent = `${getToolLabel(toolName)} is not connected yet.`;
        return;
    }

    activeToolStatus.textContent = `${getToolLabel(toolName)} selected. Editing logic coming soon.`;
    updateToolSettingsStatus();
}

function openToolMenu(menu) {
    toolMenuStack = [menu];

    toolMenu.classList.add("open");
    toolMenu.setAttribute("aria-hidden", "false");

    renderToolMenu();
}

function closeToolMenu() {
    toolMenu.classList.remove("open");
    toolMenu.setAttribute("aria-hidden", "true");
    toolMenuStack = [];
}

function renderToolMenu() {
    const currentMenu = toolMenuStack[toolMenuStack.length - 1];

    toolMenuTitle.textContent = currentMenu.title;
    toolMenuPath.textContent = currentMenu.description || currentMenu.path;

    toolMenuOptions.innerHTML = "";

    if (toolMenuStack.length > 1) {
        toolMenuBackBtn.classList.remove("hidden");
    } else {
        toolMenuBackBtn.classList.add("hidden");
    }

    currentMenu.options.forEach(function (option, index) {
        const optionButton = document.createElement("button");

        optionButton.type = "button";
        optionButton.className = "tool-menu-option";

        optionButton.innerHTML = `
            <strong>${option.label}</strong>
            <span>${option.description}</span>
        `;

        optionButton.addEventListener("click", function () {
            if (option.submenu) {
                toolMenuStack.push(option.submenu);
                renderToolMenu();
                return;
            }

            activeToolStatus.textContent = `${currentMenu.title}: ${option.label} selected. Tool logic coming soon.`;
            closeToolMenu();
        });

        toolMenuOptions.appendChild(optionButton);

        window.setTimeout(function () {
            optionButton.classList.add("visible");
        }, index * 55);
    });
}

function getToolLabel(toolName) {
    const labels = {
        pencil: "Pencil",
        eraser: "Eraser",
        picker: "Picker",
        bucket: "Bucket",
        splice: "Splice",
        colourShade: "Colour & Shade",
        undo: "Undo",
        redo: "Redo"
    };

    return labels[toolName] || toolName;
}

function setupEditorSettings() {
    syncSelectedColourUI();
    renderBrushSizeButtons();
    renderRecentColours();
    renderSkinPalette();
    updateToolSettingsStatus();

    selectedColourInput.addEventListener("input", function () {
        editorSettings.selectedColour = normaliseHex(selectedColourInput.value);
        syncSelectedColourUI();
        updateToolSettingsStatus();
    });

    selectedColourInput.addEventListener("change", function () {
        editorSettings.selectedColour = normaliseHex(selectedColourInput.value);
        addRecentColour(editorSettings.selectedColour);
        syncSelectedColourUI();
        updateToolSettingsStatus("Colour updated.");
    });

    selectedHexInput.addEventListener("blur", function () {
        applyHexInput();
    });

    selectedHexInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            applyHexInput();
        }
    });

    brushSizeButtons.forEach(function (button) {
        button.addEventListener("click", function () {
            editorSettings.brushSize = Number(button.dataset.brushSize);
            renderBrushSizeButtons();
            updateToolSettingsStatus("Brush size updated.");
        });
    });

}

function applyHexInput() {
    const rawValue = selectedHexInput.value.trim();

    if (!isValidHex(rawValue)) {
        selectedHexInput.value = editorSettings.selectedColour;
        updateToolSettingsStatus("Invalid hex colour. Reverted to previous value.");
        return;
    }

    editorSettings.selectedColour = normaliseHex(rawValue);
    addRecentColour(editorSettings.selectedColour);
    syncSelectedColourUI();
    updateToolSettingsStatus("Hex colour applied.");
}

function syncSelectedColourUI() {
    selectedColourInput.value = editorSettings.selectedColour;
    selectedHexInput.value = editorSettings.selectedColour;

    renderRecentColours();
}

function renderBrushSizeButtons() {
    brushSizeButtons.forEach(function (button) {
        const size = Number(button.dataset.brushSize);

        if (size === editorSettings.brushSize) {
            button.classList.add("active");
        } else {
            button.classList.remove("active");
        }
    });
}

function renderRecentColours() {
    recentColoursContainer.innerHTML = "";

    if (editorSettings.recentColours.length === 0) {
        recentColoursContainer.innerHTML = `<div class="swatch-button empty-swatch">None</div>`;
        return;
    }

    editorSettings.recentColours.forEach(function (colour) {
        const swatch = document.createElement("button");

        swatch.type = "button";
        swatch.className = "swatch-button";
        swatch.title = colour;
        swatch.style.background = colour;

        swatch.addEventListener("click", function () {
            editorSettings.selectedColour = colour;
            syncSelectedColourUI();
            updateToolSettingsStatus("Recent colour selected.");
        });

        recentColoursContainer.appendChild(swatch);
    });
}

function renderSkinPalette() {
    skinPaletteContainer.innerHTML = "";

    if (editorSettings.skinPalette.length === 0) {
        skinPaletteContainer.innerHTML = `<div class="swatch-button empty-swatch">No palette yet</div>`;
        return;
    }

    editorSettings.skinPalette.forEach(function (colour) {
        const swatch = document.createElement("button");

        swatch.type = "button";
        swatch.className = "swatch-button";
        swatch.title = colour;
        swatch.style.background = colour;

        swatch.addEventListener("click", function () {
            editorSettings.selectedColour = colour;
            addRecentColour(colour);
            syncSelectedColourUI();
            updateToolSettingsStatus("Palette colour selected.");
        });

        skinPaletteContainer.appendChild(swatch);
    });
}

function addRecentColour(colour) {
    const normalised = normaliseHex(colour);

    editorSettings.recentColours = [
        normalised,
        ...editorSettings.recentColours.filter(function (item) {
            return item !== normalised;
        })
    ].slice(0, 10);

    renderRecentColours();
}

function generateSkinPalette(image) {
    const paletteCanvas = document.createElement("canvas");
    const paletteContext = paletteCanvas.getContext("2d", { willReadFrequently: true });

    paletteCanvas.width = image.width;
    paletteCanvas.height = image.height;

    paletteContext.imageSmoothingEnabled = false;
    paletteContext.drawImage(image, 0, 0);

    const imageData = paletteContext.getImageData(0, 0, image.width, image.height).data;
    const colourCounts = new Map();

    for (let index = 0; index < imageData.length; index += 4) {
        const red = imageData[index];
        const green = imageData[index + 1];
        const blue = imageData[index + 2];
        const alpha = imageData[index + 3];

        if (alpha === 0) continue;

        const hex = rgbToHex(red, green, blue);
        colourCounts.set(hex, (colourCounts.get(hex) || 0) + 1);
    }

    const sortedColours = Array.from(colourCounts.entries())
        .sort(function (a, b) {
            return b[1] - a[1];
        })
        .slice(0, 14)
        .map(function (entry) {
            return entry[0];
        });

    editorSettings.skinPalette = sortedColours;
    renderSkinPalette();
    updateToolSettingsStatus("Skin palette extracted.");
}

function updateToolSettingsStatus() {
    const toolLabel = activeTool ? getToolLabel(activeTool) : "None";

    toolSettingsStatus.textContent =
        `Tool: ${toolLabel} | Colour: ${editorSettings.selectedColour} | Brush: ${editorSettings.brushSize}px`;
}

function normaliseHex(hex) {
    let value = hex.trim().toUpperCase();

    if (!value.startsWith("#")) {
        value = "#" + value;
    }

    return value;
}

function isValidHex(hex) {
    return /^#?[0-9A-Fa-f]{6}$/.test(hex.trim());
}

function resetPreview() {
    fileNameText.textContent = "None";
    fileDimensionsText.textContent = "None";
    skinTypeText.textContent = "None";
    modelChoiceText.textContent = "None";

    pendingSkinDataUrl = null;

    editorSettings.skinPalette = [];
    renderSkinPalette();
    updateToolSettingsStatus();
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