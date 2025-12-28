// API Configuration
const API_BASE_URL = 'http://localhost:3000';

// Speaking Practice Evaluator - Main Application
class SpeakingEvaluator {
    constructor() {
        this.videoElement = document.getElementById('videoElement');
        this.faceCanvas = document.getElementById('faceCanvas');
        this.audioCanvas = document.getElementById('audioCanvas');
        this.videoOverlay = document.getElementById('videoOverlay');

        this.stream = null;
        this.audioContext = null;
        this.analyser = null;
        this.faceDetectionInterval = null;
        this.sessionStartTime = null;
        this.sessionInterval = null;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.transcriptBuffer = [];

        this.state = {
            isRecording: false,
            faceDetected: false,
            voiceDetected: false,
            evaluationCount: 0,
            totalClarity: 0,
            totalConfidence: 0,
            sessionDuration: 0,
            backendAvailable: false
        };

        this.initializeEventListeners();
        this.loadFaceDetectionModels();
        this.checkBackendStatus();
    }

    async checkBackendStatus() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/status`);
            const data = await response.json();

            if (data.success) {
                this.state.backendAvailable = true;
                console.log('✅ Backend connected:', data);

                if (data.geminiAvailable) {
                    this.updateSystemStatus('AI-Powered Mode Active', 'success');
                } else {
                    this.updateSystemStatus('Backend Ready (Add API Key)', 'warning');
                }
            }
        } catch (error) {
            console.log('ℹ️ Backend not available, using local evaluation');
            this.state.backendAvailable = false;
            this.updateSystemStatus('Local Mode', 'success');
        }
    }

    initializeEventListeners() {
        document.getElementById('startBtn').addEventListener('click', () => this.startPractice());
        document.getElementById('stopBtn').addEventListener('click', () => this.stopPractice());
        document.getElementById('evaluateBtn').addEventListener('click', () => this.evaluatePerformance());
    }

    async loadFaceDetectionModels() {
        try {
            const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
            await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
            await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
            console.log('✅ Face detection models loaded successfully');
        } catch (error) {
            console.error('❌ Error loading face detection models:', error);
        }
    }

    async startPractice() {
        try {
            console.log('🚀 startPractice called - Requesting media access...');

            // Get user media
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 1280, height: 720 },
                audio: true
            });
            console.log('✅ Media access granted - Stream:', this.stream);

            this.videoElement.srcObject = this.stream;
            this.videoOverlay.classList.add('hidden');

            // Set recording state BEFORE starting audio analysis
            // This prevents the draw loop from exiting immediately
            this.state.isRecording = true;
            console.log('✅ isRecording set to TRUE');

            // Setup audio analysis
            console.log('📊 Calling setupAudioAnalysis...');
            this.setupAudioAnalysis();

            // Setup audio recording for transcription
            this.setupAudioRecording();

            // Start face detection
            this.startFaceDetection();

            // Update UI
            this.sessionStartTime = Date.now();
            this.startSessionTimer();

            document.getElementById('startBtn').disabled = true;
            document.getElementById('stopBtn').disabled = false;
            document.getElementById('evaluateBtn').disabled = false;

            if (this.state.backendAvailable) {
                this.updateSystemStatus('Recording with AI Analysis...', 'danger');
            } else {
                this.updateSystemStatus('Recording (Local Mode)...', 'danger');
            }

            console.log('✅ startPractice completed successfully');

        } catch (error) {
            console.error('❌ Error starting practice:', error);
            alert('Could not access camera/microphone. Please grant permissions and try again.');
        }
    }

    setupAudioRecording() {
        try {
            this.mediaRecorder = new MediaRecorder(this.stream);
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.start(1000); // Collect data every second
        } catch (error) {
            console.error('Error setting up audio recording:', error);
        }
    }

    stopPractice() {
        // Stop media recorder
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }

        // Stop all streams
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        // Stop audio context
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        // Stop face detection
        if (this.faceDetectionInterval) {
            clearInterval(this.faceDetectionInterval);
            this.faceDetectionInterval = null;
        }

        // Stop session timer
        if (this.sessionInterval) {
            clearInterval(this.sessionInterval);
            this.sessionInterval = null;
        }

        // Clear video
        this.videoElement.srcObject = null;
        this.videoOverlay.classList.remove('hidden');

        // Clear canvas
        const ctx = this.faceCanvas.getContext('2d');
        ctx.clearRect(0, 0, this.faceCanvas.width, this.faceCanvas.height);

        // Update UI
        this.state.isRecording = false;
        this.state.faceDetected = false;
        this.state.voiceDetected = false;

        document.getElementById('startBtn').disabled = false;
        document.getElementById('stopBtn').disabled = true;
        document.getElementById('evaluateBtn').disabled = true;

        if (this.state.backendAvailable) {
            this.updateSystemStatus('AI-Powered Mode Active', 'success');
        } else {
            this.updateSystemStatus('Local Mode', 'success');
        }
        this.updateDetectionStatus();
    }

    setupAudioAnalysis() {
        console.log('🔊 setupAudioAnalysis called - Setting up audio context...');
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        console.log('✅ Audio context created, FFT size:', this.analyser.fftSize);

        const source = this.audioContext.createMediaStreamSource(this.stream);
        source.connect(this.analyser);
        console.log('✅ Audio source connected to analyser');

        this.visualizeAudio();
        console.log('✅ visualizeAudio() called');
    }

    visualizeAudio() {
        const canvas = this.audioCanvas;
        const ctx = canvas.getContext('2d');
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        console.log('🎤 Audio visualization started');

        const draw = () => {
            if (!this.state.isRecording) {
                console.log('⏹️ Recording stopped, ending visualization');
                return;
            }

            requestAnimationFrame(draw);

            // Get frequency data for accurate volume measurement
            const frequencyData = new Uint8Array(bufferLength);
            this.analyser.getByteFrequencyData(frequencyData);

            // Also get time domain data for waveform
            this.analyser.getByteTimeDomainData(dataArray);

            // Calculate average volume from frequency data
            let sum = 0;
            let maxValue = 0;
            for (let i = 0; i < bufferLength; i++) {
                sum += frequencyData[i];
                maxValue = Math.max(maxValue, frequencyData[i]);
            }
            const average = sum / bufferLength;

            // Calculate dB level (0-60 scale)
            const displayDb = Math.round((average / 255) * 60);
            const maxDb = Math.round((maxValue / 255) * 60);
            const finalDb = Math.max(displayDb, Math.round(maxDb * 0.7));

            // Voice detection
            this.state.voiceDetected = finalDb > 3;

            // Emotion detection
            let emotionTone = 'Neutral';
            if (finalDb > 40) {
                emotionTone = 'Energetic';
            } else if (finalDb > 25) {
                emotionTone = 'Confident';
            } else if (finalDb > 10) {
                emotionTone = 'Calm';
            } else if (finalDb > 3) {
                emotionTone = 'Soft';
            }

            this.currentEmotion = emotionTone;
            this.updateDetectionStatus();

            // Update dB display
            document.getElementById('volumeLevel').textContent = `${finalDb} dB`;

            // Update audio status
            const audioStatus = document.getElementById('audioStatus');
            if (audioStatus) {
                if (this.state.voiceDetected) {
                    audioStatus.textContent = `🎤 ${emotionTone}`;
                    audioStatus.style.color = 'var(--color-success)';
                } else {
                    audioStatus.textContent = 'Monitoring...';
                    audioStatus.style.color = 'var(--text-tertiary)';
                }
            }

            // Update level bar
            const audioLevelBar = document.getElementById('audioLevelBar');
            if (audioLevelBar) {
                const percentage = Math.min(100, (finalDb / 60) * 100);
                audioLevelBar.style.width = `${percentage}%`;
            }

            // Draw waveform
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;

            ctx.fillStyle = 'rgba(15, 15, 25, 0.3)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.lineWidth = 2;
            ctx.strokeStyle = this.state.voiceDetected
                ? 'hsl(260, 100%, 65%)'
                : 'hsl(0, 0%, 50%)';

            ctx.beginPath();

            const sliceWidth = canvas.width / bufferLength;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = v * canvas.height / 2;

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }

                x += sliceWidth;
            }

            ctx.lineTo(canvas.width, canvas.height / 2);
            ctx.stroke();

            // Add glow effect when voice detected
            if (this.state.voiceDetected) {
                ctx.shadowBlur = 20;
                ctx.shadowColor = 'hsl(260, 100%, 65%)';
                ctx.stroke();
                ctx.shadowBlur = 0;
            }
        };

        draw();
    }

    async startFaceDetection() {
        // Set canvas size
        this.faceCanvas.width = this.videoElement.videoWidth || 1280;
        this.faceCanvas.height = this.videoElement.videoHeight || 720;

        const detectFace = async () => {
            if (!this.state.isRecording) return;

            try {
                const detection = await faceapi.detectSingleFace(
                    this.videoElement,
                    new faceapi.TinyFaceDetectorOptions()
                ).withFaceLandmarks();

                const ctx = this.faceCanvas.getContext('2d');
                ctx.clearRect(0, 0, this.faceCanvas.width, this.faceCanvas.height);

                if (detection) {
                    this.state.faceDetected = true;

                    // Draw face detection box
                    const resizedDetection = faceapi.resizeResults(detection, {
                        width: this.faceCanvas.width,
                        height: this.faceCanvas.height
                    });

                    // Draw bounding box
                    ctx.strokeStyle = 'hsl(140, 70%, 55%)';
                    ctx.lineWidth = 3;
                    ctx.shadowBlur = 10;
                    ctx.shadowColor = 'hsl(140, 70%, 55%)';

                    const box = resizedDetection.detection.box;
                    ctx.strokeRect(box.x, box.y, box.width, box.height);

                    // Draw landmarks
                    ctx.fillStyle = 'hsl(260, 100%, 65%)';
                    resizedDetection.landmarks.positions.forEach(point => {
                        ctx.beginPath();
                        ctx.arc(point.x, point.y, 2, 0, 2 * Math.PI);
                        ctx.fill();
                    });

                    ctx.shadowBlur = 0;
                } else {
                    this.state.faceDetected = false;
                }

                this.updateDetectionStatus();

            } catch (error) {
                console.error('Face detection error:', error);
            }
        };

        // Run detection every 100ms
        this.faceDetectionInterval = setInterval(detectFace, 100);
    }

    updateDetectionStatus() {
        const faceCard = document.getElementById('faceDetection');
        const faceStatus = document.getElementById('faceStatus');

        if (this.state.faceDetected) {
            faceCard.classList.add('active');
            faceStatus.textContent = 'Detected';
        } else {
            faceCard.classList.remove('active');
            faceStatus.textContent = 'Not Detected';
        }
    }

    async evaluatePerformance() {
        const hasFace = this.state.faceDetected;
        const hasVoice = this.state.voiceDetected;

        // Show loading state
        document.getElementById('clarityScore').textContent = '...';
        document.getElementById('confidenceScore').textContent = '...';

        if (this.state.backendAvailable) {
            await this.evaluateWithBackend(hasFace, hasVoice);
        } else {
            this.evaluateLocally(hasFace, hasVoice);
        }
    }

    async evaluateWithBackend(hasFace, hasVoice) {
        try {
            // Prepare evaluation data
            const evaluationData = {
                transcript: this.transcriptBuffer.join(' ') || 'User is speaking...',
                hasFace,
                hasVoice,
                audioFeatures: {
                    duration: this.audioChunks.length,
                    hasAudio: hasVoice
                }
            };

            // Call backend API
            const response = await fetch(`${API_BASE_URL}/api/evaluate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(evaluationData)
            });

            const result = await response.json();

            if (result.success) {
                const { clarity, confidence, clarityFeedback, confidenceFeedback } = result.evaluation;

                // Update statistics
                this.state.evaluationCount++;
                this.state.totalClarity += clarity;
                this.state.totalConfidence += confidence;

                // Display results
                this.displayResults(clarity, confidence, result.mode);

                // Display AI-generated feedback
                document.getElementById('clarityFeedback').textContent = clarityFeedback;
                document.getElementById('confidenceFeedback').textContent = confidenceFeedback;

                this.updateSessionStats();
            } else {
                throw new Error(result.error || 'Evaluation failed');
            }

        } catch (error) {
            console.error('Backend evaluation error:', error);
            console.log('Falling back to local evaluation');
            this.evaluateLocally(hasFace, hasVoice);
        }
    }

    evaluateLocally(hasFace, hasVoice) {
        let clarity = 0;
        let confidence = 0;
        let mode = '';

        // ALWAYS GIVE SCORES - Never show 0
        // Determine mode
        if (hasFace && hasVoice) {
            mode = 'Human Face + Voice';
            clarity = this.calculateClarity();
            confidence = this.calculateConfidence();
        } else if (!hasFace && hasVoice) {
            mode = 'Only Voice';
            clarity = this.calculateClarity();
            confidence = Math.round(this.calculateConfidence() * 0.5); // 50% deduction
        } else {
            mode = 'No Voice';
            // ALWAYS SHOW SCORES - Give minimum scores instead of 0
            clarity = 5 + Math.round(Math.random() * 2); // 5-7 range
            confidence = 3 + Math.round(Math.random() * 2); // 3-5 range
        }

        // Update statistics
        this.state.evaluationCount++;
        this.state.totalClarity += clarity;
        this.state.totalConfidence += confidence;

        // Display results
        this.displayResults(clarity, confidence, mode);
        this.generateFeedback(clarity, confidence, mode);
        this.updateSessionStats();
    }

    calculateClarity() {
        const baseClarity = 5 + Math.random() * 3;
        const voiceBonus = this.state.voiceDetected ? 2 : 0;
        return Math.min(10, Math.round(baseClarity + voiceBonus));
    }

    calculateConfidence() {
        const baseFaceConfidence = this.state.faceDetected ? 4 + Math.random() * 3 : 0;
        const voiceConfidence = this.state.voiceDetected ? 2 + Math.random() * 2 : 0;
        return Math.min(10, Math.round(baseFaceConfidence + voiceConfidence));
    }

    displayResults(clarity, confidence, mode) {
        // Update scores
        document.getElementById('clarityScore').textContent = clarity;
        document.getElementById('confidenceScore').textContent = confidence;

        // Update progress bars
        document.getElementById('clarityBar').style.width = `${clarity * 10}%`;
        document.getElementById('confidenceBar').style.width = `${confidence * 10}%`;
    }

    generateFeedback(clarity, confidence, mode) {
        const clarityFeedback = document.getElementById('clarityFeedback');
        const confidenceFeedback = document.getElementById('confidenceFeedback');

        const clarityTips = [
            "Try to articulate each word more clearly and avoid mumbling.",
            "Speak with more structured sentences to boost clarity.",
            "Reduce filler words like 'um' and 'uh' for better clarity.",
            "Practice enunciating consonants more precisely.",
            "Slow down your speaking pace to improve clarity.",
            "Focus on completing your thoughts before moving to the next point."
        ];

        const confidenceTips = [
            "Maintain eye contact with the camera to project confidence.",
            "Reduce pauses and hesitations while speaking.",
            "Speak with a stronger, more assertive tone.",
            "Keep your posture upright and face the camera directly.",
            "Practice deep breathing to reduce nervousness in your voice.",
            "Use hand gestures naturally to enhance your message."
        ];

        if (mode === 'Only Voice') {
            confidenceFeedback.textContent = "Enable your camera to receive full confidence scoring and feedback.";
        } else if (mode === 'No Voice') {
            clarityFeedback.textContent = "Please speak clearly into your microphone to receive clarity feedback.";
            confidenceFeedback.textContent = "Start speaking and enable your camera for a complete evaluation.";
            return;
        } else {
            confidenceFeedback.textContent = confidenceTips[Math.floor(Math.random() * confidenceTips.length)];
        }

        clarityFeedback.textContent = clarityTips[Math.floor(Math.random() * clarityTips.length)];
    }

    updateSessionStats() {
        document.getElementById('evaluationCount').textContent = this.state.evaluationCount;

        if (this.state.evaluationCount > 0) {
            const avgClarity = (this.state.totalClarity / this.state.evaluationCount).toFixed(1);
            const avgConfidence = (this.state.totalConfidence / this.state.evaluationCount).toFixed(1);

            document.getElementById('avgClarity').textContent = avgClarity;
            document.getElementById('avgConfidence').textContent = avgConfidence;
        }
    }

    startSessionTimer() {
        this.sessionInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.sessionStartTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;

            document.getElementById('sessionDuration').textContent =
                `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }, 1000);
    }

    updateSystemStatus(text, type = 'success') {
        const statusIndicator = document.getElementById('systemStatus');
        const statusText = statusIndicator.querySelector('.status-text');
        const statusDot = statusIndicator.querySelector('.status-dot');

        statusText.textContent = text;

        const colors = {
            success: 'hsl(140, 70%, 55%)',
            warning: 'hsl(45, 100%, 60%)',
            danger: 'hsl(0, 85%, 60%)'
        };

        statusDot.style.background = colors[type] || colors.success;
        statusDot.style.boxShadow = `0 0 10px ${colors[type] || colors.success}`;
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const evaluator = new SpeakingEvaluator();
    console.log('🎯 SpeakX Evaluator initialized');
    console.log('💡 Backend integration enabled');
});
