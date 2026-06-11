const upload = document.getElementById("skinUpload");
const preview = document.getElementById("skinPreview");
const statusText = document.getElementById("uploadStatus");

upload.addEventListener("change", function () {
    const file = this.files[0];

    if (!file) return;

    if (file.type !== "image/png") {
        showError("Please upload a PNG file.");
        return;
    }

    const reader = new FileReader();

    reader.onload = function (event) {
        const image = new Image();

        image.onload = function () {
            const width = image.width;
            const height = image.height;

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

    preview.src = "";
    preview.style.display = "none";
}

function showSuccess(message) {
    statusText.textContent = message;
    statusText.className = "success";
}