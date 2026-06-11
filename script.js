console.log("Skin validation script loaded");

const upload = document.getElementById("skinUpload");
const preview = document.getElementById("skinPreview");
const statusText = document.getElementById("uploadStatus");

upload.addEventListener("change", function () {
    const file = this.files[0];

    preview.src = "";
    preview.style.display = "none";

    if (!file) {
        showError("No file selected.");
        return;
    }

    console.log("Uploaded file:", file.name, file.type);

    const fileName = file.name.toLowerCase();

    if (!fileName.endsWith(".png")) {
        showError("Invalid file type. Minecraft skins must be PNG files.");
        return;
    }

    if (file.type && file.type !== "image/png") {
        showError("Invalid file type. Please upload a real PNG image.");
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

            if (!isModernSkin && !isLegacySkin) {
                showError(`Invalid skin size: ${width}x${height}. Please upload a 64x64 or 64x32 Minecraft skin.`);
                return;
            }

            preview.src = event.target.result;
            preview.style.display = "block";

            if (isModernSkin) {
                showSuccess("Valid 64x64 Minecraft skin loaded.");
            } else {
                showSuccess("Valid legacy 64x32 Minecraft skin loaded.");
            }
        };

        image.onerror = function () {
            showError("This file could not be read as an image.");
        };

        image.src = event.target.result;
    };

    reader.readAsDataURL(file);
});

function showError(message) {
    statusText.textContent = message;
    statusText.className = "error";
}

function showSuccess(message) {
    statusText.textContent = message;
    statusText.className = "success";
}