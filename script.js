let map;
let carMarker;
let accuracyCircle;
let lastPosition = null;
let watchId = null;
let idleTimer = null;
let currentRotation = 0;
let rotationAnimationId = null;


const MOVE_THRESHOLD = 10;     // meters
const IDLE_TIME = 30000;       // 30 seconds

// ================= MAP INIT =================
function initMap(lat, lng) {
    const position = { lat, lng };

    map = new google.maps.Map(document.getElementById("map"), {
        center: position,
        zoom: 18,
        tilt: 45,
        heading: 90,
        mapTypeId: "roadmap",
        disableDefaultUI: true
    });

    // 🚗 Car marker (SVG recommended)
    carMarker = new google.maps.Marker({
        position: position,
        map: map,
        icon: {
            url: "car_top_view.png",   
            scaledSize: new google.maps.Size(46, 46),
            anchor: new google.maps.Point(23, 23)
        }
    });

    // 🔵 Accuracy circle
    accuracyCircle = new google.maps.Circle({
        map: map,
        center: position,
        radius: 20,
        fillColor: "#4285F4",
        fillOpacity: 0.25,
        strokeColor: "#4285F4",
        strokeOpacity: 0.6,
        strokeWeight: 1
    });
}

// ================= START TRACKING =================
function trackRide() {
    if (!navigator.geolocation) {
        alert("Geolocation not supported");
        return;
    }

    watchId = navigator.geolocation.watchPosition(
        onMove,
        () => alert("Location access denied"),
        {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 5000
        }
    );
}

// ================= MOVEMENT HANDLER =================
function onMove(pos) {
    clearTimeout(idleTimer);

    idleTimer = setTimeout(stopTracking, IDLE_TIME);

    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const accuracy = pos.coords.accuracy;

    // First fix
    if (!lastPosition) {
    lastPosition = { lat, lng };
    initMap(lat, lng);

    // 🎯 Initialize rotation intelligently
    currentRotation = deviceHeading !== null ? deviceHeading : 0;
    smoothRotateCar(currentRotation);

    return;
}


    const distance = getDistance(
        lastPosition.lat,
        lastPosition.lng,
        lat,
        lng
    );

    // 🛑 User not moving
    if (distance < MOVE_THRESHOLD) return;

    let bearing = getBearing(
        lastPosition.lat,
        lastPosition.lng,
        lat,
        lng
    );

    // Prefer device heading if available
    if (deviceHeading !== null) {
        bearing = deviceHeading;
    }

    // ✅ Smooth rotation (NO direct setIcon)
    smoothRotateCar(bearing);


    carMarker.setPosition(newPos);
    accuracyCircle.setCenter(newPos);
    accuracyCircle.setRadius(accuracy);
    map.panTo(newPos);

    lastPosition = newPos;
}

// ================= STOP TRACKING =================
function stopTracking() {
    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
        console.log("Tracking stopped (idle)");
    }
}

// ================= UTIL FUNCTIONS =================
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;

    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function getBearing(lat1, lng1, lat2, lng2) {
    const toRad = d => d * Math.PI / 180;
    const toDeg = r => r * 180 / Math.PI;

    const y = Math.sin(toRad(lng2 - lng1)) * Math.cos(toRad(lat2));
    const x =
        Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
        Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.cos(toRad(lng2 - lng1));

    return (toDeg(Math.atan2(y, x)) + 360) % 360;
}



let isSatellite = false;

document.getElementById("mapToggleBtn").onclick = () => {
    if (!map) return;

    if (isSatellite) {
        map.setMapTypeId("roadmap");
        document.getElementById("mapToggleBtn").innerText = "🛰 Satellite";
    } else {
        map.setMapTypeId("hybrid");
        document.getElementById("mapToggleBtn").innerText = "🗺 Road";
    }

    isSatellite = !isSatellite;
};

let deviceHeading = null;

// ================= DEVICE ORIENTATION =================
function initDeviceOrientation() {
    if (typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function") {

        // iOS (Safari)
        DeviceOrientationEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === "granted") {
                    window.addEventListener("deviceorientation", onOrientation);
                }
            })
            .catch(console.error);

    } else {
        // Android / Chrome
        window.addEventListener("deviceorientationabsolute", onOrientation, true);
        window.addEventListener("deviceorientation", onOrientation, true);
    }
}

function onOrientation(event) {
    if (event.alpha === null || !carMarker) return;

    deviceHeading = 360 - event.alpha;

    // ✅ smooth rotation even when stationary
    smoothRotateCar(deviceHeading);
}

function normalizeAngle(angle) {
    return (angle + 360) % 360;
}

function shortestAngleDiff(from, to) {
    let diff = normalizeAngle(to) - normalizeAngle(from);
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    return diff;
}

function smoothRotateCar(targetAngle) {
    if (!carMarker) return;

    cancelAnimationFrame(rotationAnimationId);

    function animate() {
        const diff = shortestAngleDiff(currentRotation, targetAngle);

        // Stop when close enough
        if (Math.abs(diff) < 0.5) {
            currentRotation = targetAngle;
        } else {
            currentRotation += diff * 0.15; // 🔥 smoothness factor
        }

        carMarker.setIcon({
            url: "car_top_view.png",
            scaledSize: new google.maps.Size(46, 46),
            anchor: new google.maps.Point(23, 23),
            rotation: currentRotation
        });

        if (Math.abs(diff) >= 0.5) {
            rotationAnimationId = requestAnimationFrame(animate);
        }
    }

    animate();
}



// 🚀 AUTO START WHEN PAGE LOADS
window.onload = () => {
    initDeviceOrientation();
    trackRide();
};