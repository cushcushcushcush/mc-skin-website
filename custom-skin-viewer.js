import * as THREE from "https://esm.sh/three@0.160.1";
import { OrbitControls } from "https://esm.sh/three@0.160.1/examples/jsm/controls/OrbitControls.js";

const SKIN_SIZE = 64;

export class WalkingAnimation {
    constructor() {
        this.paused = false;
        this.speed = 0.7;
    }
}

export class CustomSkinViewer {
    constructor({ canvas, width = 520, height = 650 }) {
        this.canvas = canvas;
        this.width = width;
        this.height = height;
        this.modelType = "default";
        this.autoRotate = true;
        this.animation = new WalkingAnimation();
        this.playerObject = { skin: { modelType: this.modelType } };

        this.pointer = new THREE.Vector2();
        this.raycaster = new THREE.Raycaster();
        this.onModelClick = null;
        this.handleCanvasClick = this.handleCanvasClick.bind(this);

        this.skinCanvas = document.createElement("canvas");
        this.skinCanvas.width = SKIN_SIZE;
        this.skinCanvas.height = SKIN_SIZE;
        this.skinContext = this.skinCanvas.getContext("2d", { willReadFrequently: true });

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1F2233);

        this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
        this.camera.position.set(0, 20, 60);

        this.renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: false,
            alpha: true
        });

        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setSize(width, height, false);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.target.set(0, 16, 0);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.08;
        this.controls.enablePan = true;
        this.controls.enableZoom = true;
        this.controls.zoomSpeed = 2.35;
        this.controls.minDistance = 20;
        this.controls.maxDistance = 95;
        this.controls.update();

        this.root = new THREE.Group();
        this.scene.add(this.root);

        this.baseGroup = new THREE.Group();
        this.outerGroup = new THREE.Group();
        this.root.add(this.baseGroup);
        this.root.add(this.outerGroup);

        const ambientLight = new THREE.AmbientLight(0xffffff, 2.2);
        this.scene.add(ambientLight);

        this.clock = new THREE.Clock();
        this.resizeToCanvas = this.resizeToCanvas.bind(this);
        this.animate = this.animate.bind(this);

        window.addEventListener("resize", this.resizeToCanvas);
        this.canvas.addEventListener("click", this.handleCanvasClick);

        this.animate();
    }

    set background(value) {
        this.scene.background = new THREE.Color(value);
    }

    set fov(value) {
        this.camera.fov = value;
        this.camera.updateProjectionMatrix();
    }

    set zoom(value) {
        const distance = THREE.MathUtils.clamp(56 / Math.max(value, 0.2), 20, 95);
        this.camera.position.set(0, 20, distance);
        this.controls.update();
    }

    async loadSkin(skinDataUrl, { model = "auto-detect" } = {}) {
        await this.drawSkinToHiddenCanvas(skinDataUrl);

        this.modelType = model === "slim" ? "slim" : "default";
        this.playerObject.skin.modelType = this.modelType;

        this.rebuildPlayerModel();
        this.setOuterLayerVisible(this.outerGroup.visible);
        this.resetCameraPose();
    }

    async drawSkinToHiddenCanvas(skinDataUrl) {
        const image = await loadImage(skinDataUrl);

        this.skinContext.clearRect(0, 0, SKIN_SIZE, SKIN_SIZE);
        this.skinContext.imageSmoothingEnabled = false;
        this.skinContext.drawImage(image, 0, 0);
    }

    rebuildPlayerModel() {
    this.clearGroup(this.baseGroup);
    this.clearGroup(this.outerGroup);

    const slim = this.modelType === "slim";
    const armWidth = slim ? 3 : 4;
    const armOffset = 4 + armWidth / 2;

    const parts = getSkinParts(slim);

    this.body = this.createPart("body", 8, 12, 4, parts.body.base, [0, 18, 0], false);
    this.head = this.createPart("head", 8, 8, 8, parts.head.base, [0, 28, 0], false);
    this.outerBody = this.createPart("outerBody", 8.5, 12.5, 4.5, parts.body.outer, [0, 18, 0], true);
    this.outerHead = this.createPart("outerHead", 8.7, 8.7, 8.7, parts.head.outer, [0, 28, 0], true);

    this.rightArmPivot = this.createPivot([-armOffset, 24, 0], this.baseGroup);
    this.leftArmPivot = this.createPivot([armOffset, 24, 0], this.baseGroup);
    this.rightLegPivot = this.createPivot([-2, 12, 0], this.baseGroup);
    this.leftLegPivot = this.createPivot([2, 12, 0], this.baseGroup);

    this.outerRightArmPivot = this.createPivot([-armOffset, 24, 0], this.outerGroup);
    this.outerLeftArmPivot = this.createPivot([armOffset, 24, 0], this.outerGroup);
    this.outerRightLegPivot = this.createPivot([-2, 12, 0], this.outerGroup);
    this.outerLeftLegPivot = this.createPivot([2, 12, 0], this.outerGroup);

    this.rightArm = this.createPart("rightArm", armWidth, 12, 4, parts.rightArm.base, [0, -6, 0], false, this.rightArmPivot);
    this.leftArm = this.createPart("leftArm", armWidth, 12, 4, parts.leftArm.base, [0, -6, 0], false, this.leftArmPivot);
    this.rightLeg = this.createPart("rightLeg", 4, 12, 4, parts.rightLeg.base, [0, -6, 0], false, this.rightLegPivot);
    this.leftLeg = this.createPart("leftLeg", 4, 12, 4, parts.leftLeg.base, [0, -6, 0], false, this.leftLegPivot);

    this.outerRightArm = this.createPart("outerRightArm", armWidth + 0.5, 12.5, 4.5, parts.rightArm.outer, [0, -6.25, 0], true, this.outerRightArmPivot);
    this.outerLeftArm = this.createPart("outerLeftArm", armWidth + 0.5, 12.5, 4.5, parts.leftArm.outer, [0, -6.25, 0], true, this.outerLeftArmPivot);
    this.outerRightLeg = this.createPart("outerRightLeg", 4.5, 12.5, 4.5, parts.rightLeg.outer, [0, -6.25, 0], true, this.outerRightLegPivot);
    this.outerLeftLeg = this.createPart("outerLeftLeg", 4.5, 12.5, 4.5, parts.leftLeg.outer, [0, -6.25, 0], true, this.outerLeftLegPivot);
}


    createPart(name, width, height, depth, faces, position, isOuterLayer, parentGroup = null) {
    const geometry = new THREE.BoxGeometry(width, height, depth);

    const materials = [
        this.createFaceMaterial(faces.right),
        this.createFaceMaterial(faces.left),
        this.createFaceMaterial(faces.top),
        this.createFaceMaterial(faces.bottom),
        this.createFaceMaterial(faces.front),
        this.createFaceMaterial(faces.back)
    ];

    const mesh = new THREE.Mesh(geometry, materials);
    mesh.name = name;
    mesh.position.set(position[0], position[1], position[2]);
    mesh.userData.isOuterLayer = isOuterLayer;

    mesh.userData.faceNames = [
    "right",
    "left",
    "top",
    "bottom",
    "front",
    "back"
];

    mesh.userData.faceRects = [
    faces.right,
    faces.left,
    faces.top,
    faces.bottom,
    faces.front,
    faces.back
];

    const targetGroup = parentGroup || (isOuterLayer ? this.outerGroup : this.baseGroup);
    targetGroup.add(mesh);

    return mesh;
}

createPivot(position, parentGroup) {
    const pivot = new THREE.Group();
    pivot.position.set(position[0], position[1], position[2]);
    parentGroup.add(pivot);
    return pivot;
}

    createFaceMaterial(rect) {
        const faceCanvas = document.createElement("canvas");
        faceCanvas.width = Math.max(1, rect.w);
        faceCanvas.height = Math.max(1, rect.h);

        const faceContext = faceCanvas.getContext("2d");
        faceContext.imageSmoothingEnabled = false;
        faceContext.clearRect(0, 0, faceCanvas.width, faceCanvas.height);
        faceContext.drawImage(
            this.skinCanvas,
            rect.x,
            rect.y,
            rect.w,
            rect.h,
            0,
            0,
            rect.w,
            rect.h
        );

        const texture = new THREE.CanvasTexture(faceCanvas);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;

        return new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            alphaTest: 0.1
        });
    }

    setOuterLayerVisible(visible) {
        this.outerGroup.visible = visible;
    }

    resetCameraPose() {
        this.camera.position.set(0, 20, 60);
        this.controls.target.set(0, 18, 0);
        this.controls.update();
    }

    handleCanvasClick(event) {
    const rect = this.canvas.getBoundingClientRect();

    if (!rect.width || !rect.height) return;

    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);

    const clickableMeshes = [];

    this.root.traverse(function (child) {
    if (child.isMesh && isObjectVisibleInTree(child)) {
        clickableMeshes.push(child);
    }
});

    const hits = this.raycaster.intersectObjects(clickableMeshes, false);

    if (!hits.length) return;

    const hit = hits[0];

    const materialIndex = hit.face.materialIndex ?? 0;
    const faceName = hit.object.userData.faceNames?.[materialIndex] || getFaceLabel(hit.face.normal.clone().normalize());
    const faceRect = hit.object.userData.faceRects?.[materialIndex] || null;
    const skinPixel = faceRect && hit.uv ? getSkinPixelFromUv(faceRect, hit.uv) : null;

    const hitInfo = {
    part: getPartLabel(hit.object.name),
    rawPart: hit.object.name,
    layer: hit.object.userData.isOuterLayer ? "secondary layer" : "base layer",
    face: faceName,
    faceRect,
    skinPixel,
    uv: hit.uv ? hit.uv.clone() : null,
    point: hit.point.clone()
};

    if (typeof this.onModelClick === "function") {
        this.onModelClick(hitInfo);
    }
}

    resizeToCanvas() {
        const cssWidth = this.canvas.clientWidth || this.width;
        const cssHeight = this.canvas.clientHeight || this.height;

        this.camera.aspect = cssWidth / cssHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(cssWidth, cssHeight, false);
    }

    animate() {
        requestAnimationFrame(this.animate);

        const elapsed = this.clock.getElapsedTime();

        if (this.autoRotate) {
            this.root.rotation.y += 0.005;
        }

        if (this.animation && !this.animation.paused) {
            this.applyWalkPose(elapsed * this.animation.speed);
        }

        this.controls.update();
        this.resizeToCanvas();
        this.renderer.render(this.scene, this.camera);
    }

    applyWalkPose(time) {
    const swing = Math.sin(time * 5) * 0.45;

    if (this.rightArmPivot) this.rightArmPivot.rotation.x = swing;
    if (this.leftArmPivot) this.leftArmPivot.rotation.x = -swing;
    if (this.rightLegPivot) this.rightLegPivot.rotation.x = -swing;
    if (this.leftLegPivot) this.leftLegPivot.rotation.x = swing;

    if (this.outerRightArmPivot) this.outerRightArmPivot.rotation.x = swing;
    if (this.outerLeftArmPivot) this.outerLeftArmPivot.rotation.x = -swing;
    if (this.outerRightLegPivot) this.outerRightLegPivot.rotation.x = -swing;
    if (this.outerLeftLegPivot) this.outerLeftLegPivot.rotation.x = swing;
}

    clearGroup(group) {
        while (group.children.length > 0) {
            const child = group.children.pop();
            disposeObject(child);
        }
    }
}

function getPartLabel(rawName) {
    const withoutOuter = rawName.replace(/^outer/, "");
    return withoutOuter
        .replace(/([A-Z])/g, " $1")
        .trim()
        .toLowerCase();
}

function getFaceLabel(normal) {
    const absX = Math.abs(normal.x);
    const absY = Math.abs(normal.y);
    const absZ = Math.abs(normal.z);

    if (absX >= absY && absX >= absZ) {
        return normal.x > 0 ? "right" : "left";
    }

    if (absY >= absX && absY >= absZ) {
        return normal.y > 0 ? "top" : "bottom";
    }

    return normal.z > 0 ? "front" : "back";
}

function getSkinPixelFromUv(rect, uv) {
    const safeU = Math.min(Math.max(uv.x, 0), 0.999999);
    const safeV = Math.min(Math.max(1 - uv.y, 0), 0.999999);

    return {
        x: rect.x + Math.floor(safeU * rect.w),
        y: rect.y + Math.floor(safeV * rect.h)
    };
}

function isObjectVisibleInTree(object) {
    let currentObject = object;

    while (currentObject) {
        if (!currentObject.visible) {
            return false;
        }

        currentObject = currentObject.parent;
    }

    return true;
}

function disposeObject(object) {
    if (object.children) {
        while (object.children.length > 0) {
            const child = object.children.pop();
            disposeObject(child);
        }
    }

    if (object.geometry) object.geometry.dispose();

    if (Array.isArray(object.material)) {
        object.material.forEach(disposeMaterial);
    } else if (object.material) {
        disposeMaterial(object.material);
    }
}

function disposeMaterial(material) {
    if (material.map) material.map.dispose();
    material.dispose();
}

function loadImage(src) {
    return new Promise(function (resolve, reject) {
        const image = new Image();
        image.onload = function () {
            resolve(image);
        };
        image.onerror = reject;
        image.src = src;
    });
}

function r(x, y, w, h) {
    return { x, y, w, h };
}

function getSkinParts(slim) {
    const rightArmWidth = slim ? 3 : 4;
    const leftArmWidth = slim ? 3 : 4;

    return {
        head: {
            base: cuboidFaces({
                top: r(8, 0, 8, 8),
                bottom: r(16, 0, 8, 8),
                right: r(0, 8, 8, 8),
                front: r(8, 8, 8, 8),
                left: r(16, 8, 8, 8),
                back: r(24, 8, 8, 8)
            }),
            outer: cuboidFaces({
                top: r(40, 0, 8, 8),
                bottom: r(48, 0, 8, 8),
                right: r(32, 8, 8, 8),
                front: r(40, 8, 8, 8),
                left: r(48, 8, 8, 8),
                back: r(56, 8, 8, 8)
            })
        },
        body: {
            base: cuboidFaces({
                top: r(20, 16, 8, 4),
                bottom: r(28, 16, 8, 4),
                right: r(16, 20, 4, 12),
                front: r(20, 20, 8, 12),
                left: r(28, 20, 4, 12),
                back: r(32, 20, 8, 12)
            }),
            outer: cuboidFaces({
                top: r(20, 32, 8, 4),
                bottom: r(28, 32, 8, 4),
                right: r(16, 36, 4, 12),
                front: r(20, 36, 8, 12),
                left: r(28, 36, 4, 12),
                back: r(32, 36, 8, 12)
            })
        },
        rightArm: {
            base: cuboidFaces({
                top: r(44, 16, rightArmWidth, 4),
                bottom: r(44 + rightArmWidth, 16, rightArmWidth, 4),
                right: r(40, 20, 4, 12),
                front: r(44, 20, rightArmWidth, 12),
                left: r(44 + rightArmWidth, 20, 4, 12),
                back: r(48 + rightArmWidth, 20, rightArmWidth, 12)
            }),
            outer: cuboidFaces({
                top: r(44, 32, rightArmWidth, 4),
                bottom: r(44 + rightArmWidth, 32, rightArmWidth, 4),
                right: r(40, 36, 4, 12),
                front: r(44, 36, rightArmWidth, 12),
                left: r(44 + rightArmWidth, 36, 4, 12),
                back: r(48 + rightArmWidth, 36, rightArmWidth, 12)
            })
        },
        leftArm: {
            base: cuboidFaces({
                top: r(36, 48, leftArmWidth, 4),
                bottom: r(36 + leftArmWidth, 48, leftArmWidth, 4),
                right: r(32, 52, 4, 12),
                front: r(36, 52, leftArmWidth, 12),
                left: r(36 + leftArmWidth, 52, 4, 12),
                back: r(40 + leftArmWidth, 52, leftArmWidth, 12)
            }),
            outer: cuboidFaces({
                top: r(52, 48, leftArmWidth, 4),
                bottom: r(52 + leftArmWidth, 48, leftArmWidth, 4),
                right: r(48, 52, 4, 12),
                front: r(52, 52, leftArmWidth, 12),
                left: r(52 + leftArmWidth, 52, 4, 12),
                back: r(56 + leftArmWidth, 52, leftArmWidth, 12)
            })
        },
        rightLeg: {
            base: cuboidFaces({
                top: r(4, 16, 4, 4),
                bottom: r(8, 16, 4, 4),
                right: r(0, 20, 4, 12),
                front: r(4, 20, 4, 12),
                left: r(8, 20, 4, 12),
                back: r(12, 20, 4, 12)
            }),
            outer: cuboidFaces({
                top: r(4, 32, 4, 4),
                bottom: r(8, 32, 4, 4),
                right: r(0, 36, 4, 12),
                front: r(4, 36, 4, 12),
                left: r(8, 36, 4, 12),
                back: r(12, 36, 4, 12)
            })
        },
        leftLeg: {
            base: cuboidFaces({
                top: r(20, 48, 4, 4),
                bottom: r(24, 48, 4, 4),
                right: r(16, 52, 4, 12),
                front: r(20, 52, 4, 12),
                left: r(24, 52, 4, 12),
                back: r(28, 52, 4, 12)
            }),
            outer: cuboidFaces({
                top: r(4, 48, 4, 4),
                bottom: r(8, 48, 4, 4),
                right: r(0, 52, 4, 12),
                front: r(4, 52, 4, 12),
                left: r(8, 52, 4, 12),
                back: r(12, 52, 4, 12)
            })
        }
    };
}

function cuboidFaces(faces) {
    return faces;
}
