console.log("Skin validation script loaded");

const upload = document.getElementById("skinUpload");
const preview = document.getElementById("skinPreview");
const statusText = document.getElementById("uploadStatus");
const emptyPreviewText = document.getElementById("emptyPreviewText");

const fileNameText = document.getElementById("fileName");
const fileDimensionsText = document.getElementById("fileDimensions");
const skinTypeText = document.getElementById("skinType");

upload.addEventListener("change", function () {
    const file = this.files[0];

    resetPreview();

    if (!file) {
        showError("No file selected.");
        return;
    }

    console.log("Uploaded file:", file.name, file.type);

    const fileName = file.name.toLowerCase();

    if (!fileName.endsWith(".png")) {
        showError("Invalid file type. Minecraft skins must be PNG files.");
        fileNameText.textContent = file.name;
        return;
    }

    if (file.type && file.type !== "image/png") {
        showError("Invalid file type. Please upload a real PNG image.");
        fileNameText.textContent = file.name;
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
        };

        image.onerror = function () {
            showError("This file could not be read as an image.");
            fileNameText.textContent = file.name;
        };

        image.src = event.target.result;
    };

    reader.readAsDataURL(file);
});

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