import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import multer from 'multer';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for handling multipart/form-data
const upload = multer({ storage: multer.memoryStorage() });

// Initialize Gemini AI
let genAI;
let model;

try {
    if (!process.env.GEMINI_API_KEY) {
        console.warn('⚠️  WARNING: GEMINI_API_KEY not found in .env file');
        console.warn('⚠️  Please add your API key to the .env file');
    } else {
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        console.log('✅ Gemini AI initialized successfully');
    }
} catch (error) {
    console.error('❌ Error initializing Gemini AI:', error.message);
}

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        geminiConfigured: !!process.env.GEMINI_API_KEY
    });
});

// API status endpoint
app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        message: 'SpeakX Evaluator API is running',
        geminiAvailable: !!genAI,
        version: '1.0.0'
    });
});

// Evaluate speech with Gemini AI
app.post('/api/evaluate', async (req, res) => {
    try {
        const { transcript, hasFace, hasVoice, audioFeatures } = req.body;

        // Validate input
        if (!transcript && !hasVoice) {
            return res.status(400).json({
                success: false,
                error: 'No speech data provided'
            });
        }

        // Check if Gemini is configured
        if (!genAI || !model) {
            return res.status(503).json({
                success: false,
                error: 'Gemini AI not configured. Please add GEMINI_API_KEY to .env file'
            });
        }

        // Determine mode
        let mode = 'No Voice';
        if (hasFace && hasVoice) {
            mode = 'Human Face + Voice';
        } else if (!hasFace && hasVoice) {
            mode = 'Only Voice';
        }

        // Build evaluation prompt
        const prompt = `You are an expert communication skills evaluator. Analyze the following speaking performance and provide scores.

**Speaking Context:**
- Mode: ${mode}
- Transcript: ${transcript || 'No clear speech detected'}
- Audio Features: ${JSON.stringify(audioFeatures || {})}

**Evaluation Rules:**
1. If both face and voice are present → evaluate normally
2. If voice is present but face is not → deduct confidence by 50%
3. If both are absent → Clarity = 0, Confidence = 0

**Task:**
Evaluate the speech on:
1. **Clarity (0-10)**: How clear, articulate, and well-structured is the speech?
2. **Confidence (0-10)**: How confident and assertive is the delivery?

Provide your response in this exact JSON format:
{
  "clarity": <number 0-10>,
  "confidence": <number 0-10>,
  "clarityFeedback": "<one specific suggestion to improve clarity>",
  "confidenceFeedback": "<one specific suggestion to improve confidence>",
  "analysis": "<brief 2-3 sentence overall analysis>"
}`;

        // Call Gemini API
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Parse JSON from response
        let evaluation;
        try {
            // Extract JSON from markdown code blocks if present
            const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/\{[\s\S]*\}/);
            const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
            evaluation = JSON.parse(jsonText);
        } catch (parseError) {
            console.error('Error parsing Gemini response:', parseError);
            throw new Error('Invalid response format from AI');
        }

        // Apply mode-based adjustments
        if (mode === 'Only Voice') {
            evaluation.confidence = Math.round(evaluation.confidence * 0.5);
            evaluation.confidenceFeedback = 'Enable your camera to receive full confidence scoring and feedback.';
        } else if (mode === 'No Voice') {
            evaluation.clarity = 0;
            evaluation.confidence = 0;
            evaluation.clarityFeedback = 'Please speak clearly into your microphone to receive clarity feedback.';
            evaluation.confidenceFeedback = 'Start speaking and enable your camera for a complete evaluation.';
        }

        // Return evaluation
        res.json({
            success: true,
            mode,
            evaluation: {
                clarity: Math.min(10, Math.max(0, evaluation.clarity)),
                confidence: Math.min(10, Math.max(0, evaluation.confidence)),
                clarityFeedback: evaluation.clarityFeedback,
                confidenceFeedback: evaluation.confidenceFeedback,
                analysis: evaluation.analysis
            }
        });

    } catch (error) {
        console.error('Error in /api/evaluate:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to evaluate speech'
        });
    }
});

// Analyze audio with Gemini (for advanced features)
app.post('/api/analyze-audio', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No audio file provided'
            });
        }

        if (!genAI || !model) {
            return res.status(503).json({
                success: false,
                error: 'Gemini AI not configured'
            });
        }

        // Convert audio buffer to base64
        const audioBase64 = req.file.buffer.toString('base64');
        const mimeType = req.file.mimetype || 'audio/webm';

        const prompt = `Analyze this audio recording of someone speaking. Evaluate:
1. Speech clarity and articulation
2. Confidence and tone
3. Pace and rhythm
4. Any filler words or hesitations

Provide scores (0-10) for clarity and confidence, plus specific feedback.`;

        // Use Gemini with audio
        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: audioBase64,
                    mimeType: mimeType
                }
            }
        ]);

        const response = await result.response;
        const text = response.text();

        res.json({
            success: true,
            analysis: text
        });

    } catch (error) {
        console.error('Error in /api/analyze-audio:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to analyze audio'
        });
    }
});

// Get feedback suggestions
app.post('/api/feedback', async (req, res) => {
    try {
        const { clarity, confidence, mode } = req.body;

        if (!genAI || !model) {
            // Fallback to predefined feedback
            return res.json({
                success: true,
                feedback: getFallbackFeedback(clarity, confidence, mode)
            });
        }

        const prompt = `As a communication coach, provide specific, actionable feedback for someone with these scores:
- Clarity: ${clarity}/10
- Confidence: ${confidence}/10
- Mode: ${mode}

Provide exactly 2 suggestions in JSON format:
{
  "clarityTip": "<one specific tip to improve clarity>",
  "confidenceTip": "<one specific tip to improve confidence>"
}`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Parse response
        const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/\{[\s\S]*\}/);
        const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
        const feedback = JSON.parse(jsonText);

        res.json({
            success: true,
            feedback
        });

    } catch (error) {
        console.error('Error in /api/feedback:', error);
        res.json({
            success: true,
            feedback: getFallbackFeedback(req.body.clarity, req.body.confidence, req.body.mode)
        });
    }
});

// Fallback feedback when Gemini is not available
function getFallbackFeedback(clarity, confidence, mode) {
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

    let confidenceTip = confidenceTips[Math.floor(Math.random() * confidenceTips.length)];

    if (mode === 'Only Voice') {
        confidenceTip = "Enable your camera to receive full confidence scoring and feedback.";
    } else if (mode === 'No Voice') {
        return {
            clarityTip: "Please speak clearly into your microphone to receive clarity feedback.",
            confidenceTip: "Start speaking and enable your camera for a complete evaluation."
        };
    }

    return {
        clarityTip: clarityTips[Math.floor(Math.random() * clarityTips.length)],
        confidenceTip
    };
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

// Start server
app.listen(PORT, () => {
    console.log('🚀 SpeakX Evaluator Backend Server');
    console.log(`📡 Server running on http://localhost:${PORT}`);
    console.log(`🌍 CORS enabled for: ${process.env.FRONTEND_URL || '*'}`);
    console.log(`🤖 Gemini AI: ${genAI ? '✅ Configured' : '❌ Not configured'}`);
    console.log('\n📋 Available endpoints:');
    console.log(`   GET  /health - Health check`);
    console.log(`   GET  /api/status - API status`);
    console.log(`   POST /api/evaluate - Evaluate speech`);
    console.log(`   POST /api/analyze-audio - Analyze audio file`);
    console.log(`   POST /api/feedback - Get feedback suggestions`);
    console.log('\n💡 Add your Gemini API key to .env file to enable AI features\n');
});
