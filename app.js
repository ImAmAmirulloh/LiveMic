/**
 * Live Mic - Audio Conference Application
 * Menggunakan WebRTC untuk real-time audio streaming
 */

// ===== State Management =====
const state = {
    mode: null, // 'speaker' or 'listener'
    roomCode: null,
    isLive: false,
    isConnected: false,
    localStream: null,
    peerConnection: null,
    audioElement: null,
    listenerCount: 0
};

// ===== Configuration =====
const config = {
    // STUN/TURN servers untuk WebRTC
    iceServers: [
        {
            urls: 'stun:stun.l.google.com:19302'
        },
        {
            urls: 'stun:stun1.l.google.com:19302'
        }
    ]
};

// ===== DOM Elements =====
const elements = {
    modeSection: document.getElementById('modeSection'),
    speakerSection: document.getElementById('speakerSection'),
    listenerSection: document.getElementById('listenerSection'),
    roomCode: document.getElementById('roomCode'),
    micBtn: document.getElementById('micBtn'),
    micBtnText: document.getElementById('micBtnText'),
    micStatus: document.getElementById('micStatus'),
    listenerCount: document.getElementById('listenerCount'),
    roomInput: document.getElementById('roomInput'),
    listeningPanel: document.getElementById('listeningPanel'),
    currentRoom: document.getElementById('currentRoom'),
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toastMessage'),
    permissionModal: document.getElementById('permissionModal')
};

// ===== Utility Functions =====

/**
 * Generate random room code
 */
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

/**
 * Show toast notification
 */
function showToast(message, duration = 3000) {
    elements.toastMessage.textContent = message;
    elements.toast.classList.remove('hidden');
    setTimeout(() => {
        elements.toast.classList.add('hidden');
    }, duration);
}

/**
 * Copy text to clipboard
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast('Kode berhasil disalin!');
    } catch (err) {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('Kode berhasil disalin!');
    }
}

// ===== Navigation Functions =====

/**
 * Select mode (speaker or listener)
 */
function selectMode(mode) {
    state.mode = mode;

    if (mode === 'speaker') {
        elements.modeSection.classList.add('hidden');
        elements.speakerSection.classList.remove('hidden');
        state.roomCode = generateRoomCode();
        elements.roomCode.textContent = state.roomCode;
    } else {
        elements.modeSection.classList.add('hidden');
        elements.listenerSection.classList.remove('hidden');
    }
}

/**
 * Go back to mode selection
 */
function goBack() {
    // Stop any active streams
    if (state.isLive) {
        stopStreaming();
    }
    if (state.isConnected) {
        leaveRoom();
    }

    // Reset state
    state.mode = null;
    state.roomCode = null;
    state.isLive = false;
    state.isConnected = false;

    // Reset UI
    elements.micStatus.classList.remove('active');
    elements.micBtn.classList.remove('live');
    elements.micBtnText.textContent = 'Tap to Go Live';
    elements.listeningPanel.classList.add('hidden');
    elements.roomInput.value = '';

    // Show mode selection
    elements.speakerSection.classList.add('hidden');
    elements.listenerSection.classList.add('hidden');
    elements.modeSection.classList.remove('hidden');
}

// ===== Speaker Functions =====

/**
 * Request microphone permission
 */
function requestMicPermission() {
    elements.permissionModal.classList.remove('hidden');
}

/**
 * Close permission modal
 */
function closePermissionModal() {
    elements.permissionModal.classList.add('hidden');
}

/**
 * Toggle microphone on/off
 */
async function toggleMic() {
    if (!state.isLive) {
        // Request permission and start streaming
        await startStreaming();
    } else {
        // Stop streaming
        stopStreaming();
    }
}

/**
 * Start audio streaming
 */
async function startStreaming() {
    try {
        // Request microphone access
        state.localStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });

        state.isLive = true;

        // Update UI
        elements.micStatus.classList.add('active');
        elements.micBtn.classList.add('live');
        elements.micBtnText.textContent = 'Tap to End';

        // Initialize WebRTC connection
        await initializeWebRTC();

        showToast('Streaming aktif! Pendengar dapat mendengar Anda.');

        // Simulate listener count (in real app, this would come from server)
        simulateListenerActivity();

    } catch (err) {
        console.error('Error starting stream:', err);
        closePermissionModal();
        showToast('Gagal mengakses mikrofon. Pastikan izin diberikan.');
    }
}

/**
 * Stop audio streaming
 */
function stopStreaming() {
    // Stop all tracks
    if (state.localStream) {
        state.localStream.getTracks().forEach(track => track.stop());
        state.localStream = null;
    }

    // Close peer connection
    if (state.peerConnection) {
        state.peerConnection.close();
        state.peerConnection = null;
    }

    state.isLive = false;

    // Update UI
    elements.micStatus.classList.remove('active');
    elements.micBtn.classList.remove('live');
    elements.micBtnText.textContent = 'Tap to Go Live';
    elements.listenerCount.textContent = '0';

    showToast('Streaming dihentikan.');
}

/**
 * Initialize WebRTC peer connection
 */
async function initializeWebRTC() {
    // Create peer connection
    state.peerConnection = new RTCPeerConnection(config);

    // Add local stream tracks
    if (state.localStream) {
        state.localStream.getTracks().forEach(track => {
            state.peerConnection.addTrack(track, state.localStream);
        });
    }

    // Handle ICE candidates
    state.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            // Send ICE candidate to signaling server
            console.log('ICE candidate:', event.candidate);
            // sendToSignalingServer({
            //     type: 'ice-candidate',
            //     candidate: event.candidate,
            //     roomCode: state.roomCode
            // });
        }
    };

    // Handle connection state changes
    state.peerConnection.onconnectionstatechange = () => {
        console.log('Connection state:', state.peerConnection.connectionState);
    };

    // Create offer for new connections
    if (state.peerConnection.signalingState === 'stable') {
        const offer = await state.peerConnection.createOffer();
        await state.peerConnection.setLocalDescription(offer);

        // Send offer to signaling server
        console.log('WebRTC offer created');
        // sendToSignalingServer({
        //     type: 'offer',
        //     offer: offer,
        //     roomCode: state.roomCode
        // });
    }
}

/**
 * Simulate listener activity (for demo purposes)
 */
function simulateListenerActivity() {
    // Simulate random listeners joining
    const interval = setInterval(() => {
        if (!state.isLive) {
            clearInterval(interval);
            return;
        }

        // Random chance for listener count to change
        const change = Math.floor(Math.random() * 3) - 1;
        state.listenerCount = Math.max(0, state.listenerCount + change + 1);
        elements.listenerCount.textContent = state.listenerCount;
    }, 3000);
}

/**
 * Copy room code to clipboard
 */
function copyRoomCode() {
    copyToClipboard(state.roomCode);
}

// ===== Listener Functions =====

/**
 * Join a room
 */
async function joinRoom() {
    const roomCode = elements.roomInput.value.trim().toUpperCase();

    if (roomCode.length < 4) {
        showToast('Masukkan kode room yang valid');
        return;
    }

    state.roomCode = roomCode;

    try {
        // Request microphone for echo cancellation
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop()); // Stop after getting permission

        // Connect to room
        await connectToRoom(roomCode);

        // Update UI
        elements.listeningPanel.classList.remove('hidden');
        elements.currentRoom.textContent = roomCode;
        state.isConnected = true;

        showToast('Berhasil bergabung dengan room!');

    } catch (err) {
        console.error('Error joining room:', err);
        showToast('Gagal bergabung. Coba lagi.');
    }
}

/**
 * Connect to room via WebRTC
 */
async function connectToRoom(roomCode) {
    // Create peer connection
    state.peerConnection = new RTCPeerConnection(config);

    // Create audio element for receiving audio
    state.audioElement = document.createElement('audio');
    state.audioElement.autoplay = true;

    // Handle incoming tracks
    state.peerConnection.ontrack = (event) => {
        console.log('Received remote track:', event.track);
        state.audioElement.srcObject = event.streams[0];
    };

    // Handle ICE candidates
    state.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            console.log('ICE candidate:', event.candidate);
            // sendToSignalingServer({
            //     type: 'ice-candidate',
            //     candidate: event.candidate,
            //     roomCode: roomCode
            // });
        }
    };

    // Create offer
    const offer = await state.peerConnection.createOffer();
    await state.peerConnection.setLocalDescription(offer);

    // Send offer to signaling server
    console.log('Joining room:', roomCode);
    // sendToSignalingServer({
    //     type: 'join-room',
    //     offer: offer,
    //     roomCode: roomCode
    // });
}

/**
 * Leave current room
 */
function leaveRoom() {
    // Close peer connection
    if (state.peerConnection) {
        state.peerConnection.close();
        state.peerConnection = null;
    }

    // Stop audio element
    if (state.audioElement) {
        state.audioElement.srcObject = null;
        state.audioElement = null;
    }

    state.isConnected = false;

    // Update UI
    elements.listeningPanel.classList.add('hidden');
    elements.roomInput.value = '';

    showToast('Anda telah keluar dari room.');
}

// ===== Signaling Server Functions =====

/**
 * Placeholder for signaling server connection
 * Dalam implementasi nyata, Anda perlu:
 * 1. WebSocket server untuk real-time messaging
 * 2. Room management untuk multiple rooms
 * 3. User authentication dan authorization
 */
const signalingServer = {
    socket: null,

    connect() {
        // Contoh koneksi WebSocket
        // this.socket = new WebSocket('wss://your-signaling-server.com');

        // this.socket.onopen = () => {
        //     console.log('Connected to signaling server');
        // };

        // this.socket.onmessage = (event) => {
        //     const data = JSON.parse(event.data);
        //     handleSignalingMessage(data);
        // };

        // this.socket.onclose = () => {
        //     console.log('Disconnected from signaling server');
        // };
    },

    send(data) {
        // if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        //     this.socket.send(JSON.stringify(data));
        // }
    }
};

/**
 * Handle messages from signaling server
 */
function handleSignalingMessage(data) {
    switch (data.type) {
        case 'offer':
            handleOffer(data.offer, data.from);
            break;
        case 'answer':
            handleAnswer(data.answer);
            break;
        case 'ice-candidate':
            handleIceCandidate(data.candidate);
            break;
        case 'user-joined':
            console.log('User joined:', data.userId);
            break;
        case 'user-left':
            console.log('User left:', data.userId);
            break;
        case 'listener-count':
            state.listenerCount = data.count;
            elements.listenerCount.textContent = state.listenerCount;
            break;
    }
}

/**
 * Handle incoming offer
 */
async function handleOffer(offer, from) {
    const answer = await state.peerConnection.createAnswer();
    await state.peerConnection.setLocalDescription(answer);

    signalingServer.send({
        type: 'answer',
        answer: answer,
        to: from
    });
}

/**
 * Handle incoming answer
 */
async function handleAnswer(answer) {
    await state.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
}

/**
 * Handle incoming ICE candidate
 */
async function handleIceCandidate(candidate) {
    try {
        await state.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
        console.error('Error adding ICE candidate:', err);
    }
}

// ===== Audio Processing =====

/**
 * Create audio context for processing
 */
function createAudioContext() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    return audioContext;
}

/**
 * Process audio with effects (optional)
 */
function processAudio(stream, audioContext) {
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();

    source.connect(analyser);

    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function draw() {
        requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);
        // Update visualizer here
    }

    draw();

    return analyser;
}

// ===== Event Listeners =====

// Handle permission modal close on backdrop click
elements.permissionModal.addEventListener('click', (e) => {
    if (e.target === elements.permissionModal) {
        closePermissionModal();
    }
});

// Handle Enter key on room input
elements.roomInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        joinRoom();
    }
});

// Handle visibility change (pause/resume)
document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.isLive) {
        showToast('Streaming berjalan di background');
    }
});

// Initialize on load
window.addEventListener('load', () => {
    console.log('Live Mic App initialized');
    console.log('WebRTC support:', !!window.RTCPeerConnection);
    console.log('MediaDevices support:', !!navigator.mediaDevices);
});

// ===== Export for debugging =====
window.liveMic = {
    state,
    startStreaming,
    stopStreaming,
    joinRoom,
    leaveRoom
};
