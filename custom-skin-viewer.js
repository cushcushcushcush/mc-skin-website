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
        this.onModelPointer = null;
        this.shouldUsePaintInteraction = null;

        this.isPaintingPointer = false;
        this.activePointerId = null;
        this.isNavigationPointer = false;
        this.navigationPointerId = null;
        this.cursorMode = "navigate";
        this.autoRotateBeforePaint = false;

        this.handleCanvasClick = this.handleCanvasClick.bind(this);
        this.handleCanvasPointerDown = this.handleCanvasPointerDown.bind(this);
        this.handleCanvasPointerMove = this.handleCanvasPointerMove.bind(this);
        this.handleCanvasPointerUp = this.handleCanvasPointerUp.bind(this);
        this.handleCanvasPointerCancel = this.handleCanvasPointerCancel.bind(this);
        this.handleCanvasContextMenu = this.handleCanvasContextMenu.bind(this);
        this.handleCanvasWheel = this.handleCanvasWheel.bind(this);
        this.resizeToCanvas = this.resizeToCanvas.bind(this);
        this.animate = this.animate.bind(this);

        this.skinCanvas = document.createElement("canvas");
        this.skinCanvas.width = SKIN_SIZE;
        this.skinCanvas.height = SKIN_SIZE;
        this.skinContext = this.skinCanvas.getContext("2d", { willReadFrequently: true });
        this.skinContext.imageSmoothingEnabled = false;

        this.skinTexture = new THREE.CanvasTexture(this.skinCanvas);
        this.configureSkinTexture();

        this.skinMaterial = new THREE.MeshBasicMaterial({
            map: this.skinTexture,
            transparent: true,
            alphaTest: 0.1
        });

        this.skinMaterials = [
            this.skinMaterial,
            this.skinMaterial,
            this.skinMaterial,
            this.skinMaterial,
            this.skinMaterial,
            this.skinMaterial
        ];

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
        this.controls.target.set(0, 18, 0);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.08;
        this.controls.enablePan = true;
        this.controls.enableZoom = true;
        this.controls.zoomSpeed = 2.35;
        this.controls.minDistance = 20;
        this.controls.maxDistance = 95;
        this.controls.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.ROTATE
        };
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

        window.addEventListener("resize", this.resizeToCanvas);
        this.canvas.addEventListener("pointerdown", this.handleCanvasPointerDown, true);
        this.canvas.addEventListener("pointermove", this.handleCanvasPointerMove, true);
        this.canvas.addEventListener("pointerup", this.handleCanvasPointerUp, true);
        this.canvas.addEventListener("pointercancel", this.handleCanvasPointerCancel, true);
        this.canvas.addEventListener("contextmenu", this.handleCanvasContextMenu);
        this.canvas.addEventListener("wheel", this.handleCanvasWheel, { passive: false });
        this.canvas.addEventListener("click", this.handleCanvasClick);

        this.updateCanvasCursor();
        this.animate();
    }

    configureSkinTexture() {
        this.skinTexture.magFilter = THREE.NearestFilter;
        this.skinTexture.minFilter = THREE.NearestFilter;
        this.skinTexture.generateMipmaps = false;
        this.skinTexture.colorSpace = THREE.SRGBColorSpace;
        this.skinTexture.needsUpdate = true;
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

    async loadSkin(skinDataUrl, { model = "auto-detect", preserveView = false } = {}) {
        const image = await loadImage(skinDataUrl);

        this.skinCanvas.width = SKIN_SIZE;
        this.skinCanvas.height = SKIN_SIZE;
        this.skinContext = this.skinCanvas.getContext("2d", { willReadFrequently: true });
        this.skinContext.imageSmoothingEnabled = false;
        this.skinContext.clearRect(0, 0, SKIN_SIZE, SKIN_SIZE);
        this.skinContext.drawImage(image, 0, 0);

        this.skinTexture.image = this.skinCanvas;
        this.skinTexture.needsUpdate = true;

        this.loadCurrentTextureIntoModel({ model, preserveView });
    }

    loadSkinCanvas(sourceCanvas, { model = "auto-detect", preserveView = false } = {}) {
        this.skinCanvas = sourceCanvas;
        this.skinTexture.image = sourceCanvas;
        this.skinTexture.needsUpdate = true;

        this.loadCurrentTextureIntoModel({ model, preserveView });
    }

    loadCurrentTextureIntoModel({ model = "auto-detect", preserveView = false } = {}) {
        this.modelType = model === "slim" ? "slim" : "default";
        this.playerObject.skin.modelType = this.modelType;

        this.rebuildPlayerModel();
        this.setOuterLayerVisible(this.outerGroup.visible);

        if (!preserveView) {
            this.resetCameraPose();
        }
    }

    markTextureDirty() {
        this.skinTexture.needsUpdate = true;
    }

    rebuildPlayerModel() {
        this.clearGroup(this.baseGroup);
        this.clearGroup(this.outerGroup);

        const slim = this.modelType === "slim";
        const armWidth = slim ? 3 : 4;
        const armOffset = 4 + armWidth / 2;
        const outerArmWidth = armWidth + 0.5;
        const outerArmOffset = 4.25 + outerArmWidth / 2;
        const outerLegOffset = 2.25;
        const parts = getSkinParts(slim);

        this.body = this.createPart("body", 8, 12, 4, parts.body.base, [0, 18, 0], false);
        this.head = this.createPart("head", 8, 8, 8, parts.head.base, [0, 28, 0], false);
        this.outerBody = this.createPart("outerBody", 8.5, 12.5, 4.5, parts.body.outer, [0, 18, 0], true);
        this.outerHead = this.createPart("outerHead", 8.7, 8.7, 8.7, parts.head.outer, [0, 28, 0], true);

        this.rightArmPivot = this.createPivot([-armOffset, 24, 0], this.baseGroup);
        this.leftArmPivot = this.createPivot([armOffset, 24, 0], this.baseGroup);
        this.rightLegPivot = this.createPivot([-2, 12, 0], this.baseGroup);
        this.leftLegPivot = this.createPivot([2, 12, 0], this.baseGroup);

        this.outerRightArmPivot = this.createPivot([-outerArmOffset, 24, 0], this.outerGroup);
        this.outerLeftArmPivot = this.createPivot([outerArmOffset, 24, 0], this.outerGroup);
        this.outerRightLegPivot = this.createPivot([-outerLegOffset, 12, 0], this.outerGroup);
        this.outerLeftLegPivot = this.createPivot([outerLegOffset, 12, 0], this.outerGroup);

        this.rightArm = this.createPart("rightArm", armWidth, 12, 4, parts.rightArm.base, [0, -6, 0], false, this.rightArmPivot);
        this.leftArm = this.createPart("leftArm", armWidth, 12, 4, parts.leftArm.base, [0, -6, 0], false, this.leftArmPivot);
        this.rightLeg = this.createPart("rightLeg", 4, 12, 4, parts.rightLeg.base, [0, -6, 0], false, this.rightLegPivot);
        this.leftLeg = this.createPart("leftLeg", 4, 12, 4, parts.leftLeg.base, [0, -6, 0], false, this.leftLegPivot);

        this.outerRightArm = this.createPart("outerRightArm", outerArmWidth, 12.5, 4.5, parts.rightArm.outer, [0, -6.25, 0], true, this.outerRightArmPivot);
        this.outerLeftArm = this.createPart("outerLeftArm", outerArmWidth, 12.5, 4.5, parts.leftArm.outer, [0, -6.25, 0], true, this.outerLeftArmPivot);
        this.outerRightLeg = this.createPart("outerRightLeg", 4.5, 12.5, 4.5, parts.rightLeg.outer, [0, -6.25, 0], true, this.outerRightLegPivot);
        this.outerLeftLeg = this.createPart("outerLeftLeg", 4.5, 12.5, 4.5, parts.leftLeg.outer, [0, -6.25, 0], true, this.outerLeftLegPivot);
    }

    createPart(name, width, height, depth, faces, position, isOuterLayer, parentGroup = null) {
        const geometry = createUvMappedBoxGeometry(width, height, depth, faces);

        const mesh = new THREE.Mesh(geometry, this.skinMaterials);
        mesh.name = name;
        mesh.position.set(position[0], position[1], position[2]);

        mesh.userData.isOuterLayer = isOuterLayer;
        mesh.userData.faceNames = ["right", "left", "top", "bottom", "front", "back"];

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

    setOuterLayerVisible(visible) {
        this.outerGroup.visible = visible;
    }

    resetCameraPose() {
        this.camera.position.set(0, 20, 60);
        this.controls.target.set(0, 18, 0);
        this.controls.update();
    }

    handleCanvasPointerDown(event) {
        if (this.shouldCapturePaintInteraction(event)) {
            const hitInfo = this.getHitInfoFromEvent(event);
            if (!hitInfo) return;

            event.preventDefault();
            event.stopPropagation();

            this.isPaintingPointer = true;
            this.activePointerId = event.pointerId;
            this.autoRotateBeforePaint = this.autoRotate;
            this.autoRotate = false;

            if (this.controls) {
                this.controls.enabled = false;
            }

            this.capturePointer(event.pointerId);
            this.updateCanvasCursor();

            this.emitModelPointerFromHit(hitInfo, "down", event);
            return;
        }

        if (event.button === 0 || event.button === 2) {
            this.isNavigationPointer = true;
            this.navigationPointerId = event.pointerId;
            this.capturePointer(event.pointerId);
            this.updateCanvasCursor();
        }
    }

    handleCanvasPointerMove(event) {
        if (!this.isPaintingPointer || event.pointerId !== this.activePointerId) return;

        event.preventDefault();
        event.stopPropagation();

        this.emitModelPointer(event, "move");
    }

    handleCanvasPointerUp(event) {
        if (this.isPaintingPointer && event.pointerId === this.activePointerId) {
            event.preventDefault();
            event.stopPropagation();

            this.emitModelPointer(event, "up");
            this.endPaintPointer(event);
            return;
        }

        if (this.isNavigationPointer && event.pointerId === this.navigationPointerId) {
            this.endNavigationPointer(event);
        }
    }

    handleCanvasPointerCancel(event) {
        if (this.isPaintingPointer && event.pointerId === this.activePointerId) {
            event.preventDefault();
            event.stopPropagation();

            this.emitModelPointer(event, "cancel");
            this.endPaintPointer(event);
            return;
        }

        if (this.isNavigationPointer && event.pointerId === this.navigationPointerId) {
            this.endNavigationPointer(event);
        }
    }

    endPaintPointer(event) {
        this.releasePointer(event.pointerId);

        this.isPaintingPointer = false;
        this.activePointerId = null;
        this.autoRotate = this.autoRotateBeforePaint;

        if (this.controls) {
            this.controls.enabled = true;
        }

        this.updateCanvasCursor();
    }

    endNavigationPointer(event) {
        this.releasePointer(event.pointerId);

        this.isNavigationPointer = false;
        this.navigationPointerId = null;

        this.updateCanvasCursor();
    }

    capturePointer(pointerId) {
        if (this.canvas.setPointerCapture) {
            this.canvas.setPointerCapture(pointerId);
        }
    }

    releasePointer(pointerId) {
        if (this.canvas.releasePointerCapture && this.canvas.hasPointerCapture?.(pointerId)) {
            this.canvas.releasePointerCapture(pointerId);
        }
    }

    setCursorMode(mode) {
        this.cursorMode = mode;
        this.updateCanvasCursor();
    }

    updateCanvasCursor() {
        if (this.isNavigationPointer) {
            this.canvas.style.cursor = "grabbing";
            return;
        }

        if (this.isPaintingPointer || this.cursorMode === "paint") {
            this.canvas.style.cursor = "crosshair";
            return;
        }

        this.canvas.style.cursor = "grab";
    }

    handleCanvasContextMenu(event) {
        event.preventDefault();
    }

    handleCanvasWheel(event) {
        const rightMouseHeld = (event.buttons & 2) === 2;

        if (!rightMouseHeld) return;

        event.preventDefault();
        event.stopPropagation();

        const currentDistance = this.camera.position.distanceTo(this.controls.target);
        const zoomFactor = event.deltaY > 0 ? 1.08 : 0.92;
        const nextDistance = THREE.MathUtils.clamp(
            currentDistance * zoomFactor,
            this.controls.minDistance,
            this.controls.maxDistance
        );

        const direction = this.camera.position.clone().sub(this.controls.target).normalize();

        this.camera.position.copy(
            this.controls.target.clone().add(direction.multiplyScalar(nextDistance))
        );

        this.controls.update();
    }

    handleCanvasClick(event) {
        if (this.shouldCapturePaintInteraction(event)) return;

        const hitInfo = this.getHitInfoFromEvent(event);
        if (!hitInfo) return;

        if (typeof this.onModelClick === "function") {
            this.onModelClick(hitInfo);
        }
    }

    shouldCapturePaintInteraction(event) {
        return typeof this.shouldUsePaintInteraction === "function"
            && this.shouldUsePaintInteraction(event);
    }

    emitModelPointer(event, eventType) {
        const hitInfo = this.getHitInfoFromEvent(event);

        if (!hitInfo && (eventType === "up" || eventType === "cancel")) {
            if (typeof this.onModelPointer === "function") {
                this.onModelPointer(null, eventType, event);
            }

            return;
        }

        if (!hitInfo) return;

        this.emitModelPointerFromHit(hitInfo, eventType, event);
    }

    emitModelPointerFromHit(hitInfo, eventType, event) {
        if (typeof this.onModelPointer === "function") {
            this.onModelPointer(hitInfo, eventType, event);
        }
    }

    getHitInfoFromEvent(event) {
        const rect = this.canvas.getBoundingClientRect();

        if (!rect.width || !rect.height) return null;

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

        if (!hits.length) return null;

        const hit = hits[0];
        const materialIndex = hit.face.materialIndex ?? 0;
        const faceName = hit.object.userData.faceNames?.[materialIndex] || "unknown";
        const skinPixel = hit.uv ? getSkinPixelFromUv(hit.uv) : null;

        return {
            part: getPartLabel(hit.object.name),
            rawPart: hit.object.name,
            layer: hit.object.userData.isOuterLayer ? "secondary layer" : "base layer",
            face: faceName,
            skinPixel,
            uv: hit.uv ? hit.uv.clone() : null,
            point: hit.point.clone()
        };
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
            disposeObjectGeometry(child);
        }
    }
}

function createUvMappedBoxGeometry(width, height, depth, faces) {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const uv = geometry.attributes.uv;
    const rects = [
        faces.right,
        faces.left,
        faces.top,
        faces.bottom,
        faces.front,
        faces.back
    ];

    rects.forEach(function (rect, faceIndex) {
        applySkinRectToFace(uv, faceIndex, rect);
    });

    uv.needsUpdate = true;

    return geometry;
}

function applySkinRectToFace(uvAttribute, faceIndex, rect) {
    const vertexOffset = faceIndex * 4;

    const u0 = rect.x / SKIN_SIZE;
    const u1 = (rect.x + rect.w) / SKIN_SIZE;
    const v0 = 1 - ((rect.y + rect.h) / SKIN_SIZE);
    const v1 = 1 - (rect.y / SKIN_SIZE);

    uvAttribute.setXY(vertexOffset + 0, u1, v1);
    uvAttribute.setXY(vertexOffset + 1, u0, v1);
    uvAttribute.setXY(vertexOffset + 2, u1, v0);
    uvAttribute.setXY(vertexOffset + 3, u0, v0);
}

function getSkinPixelFromUv(uv) {
    const safeU = Math.min(Math.max(uv.x, 0), 0.999999);
    const safeV = Math.min(Math.max(1 - uv.y, 0), 0.999999);

    return {
        x: Math.floor(safeU * SKIN_SIZE),
        y: Math.floor(safeV * SKIN_SIZE)
    };
}

function getPartLabel(rawName) {
    const withoutOuter = rawName.replace(/^outer/, "");
    return withoutOuter
        .replace(/([A-Z])/g, " $1")
        .trim()
        .toLowerCase();
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

function disposeObjectGeometry(object) {
    if (object.children) {
        while (object.children.length > 0) {
            const child = object.children.pop();
            disposeObjectGeometry(child);
        }
    }

    if (object.geometry) {
        object.geometry.dispose();
    }
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
