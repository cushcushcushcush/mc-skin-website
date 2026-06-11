const upload = document.getElementById("skinUpload");
const preview = document.getElementById("skinPreview");

upload.addEventListener("change", function () {

    const file = this.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = function (event) {
        preview.src = event.target.result;
        preview.style.display = "block";
    };

    reader.readAsDataURL(file);
});