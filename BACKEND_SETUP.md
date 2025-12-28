# Backend Setup Guide

## 🚀 Quick Start

### 1. Install Dependencies

Open terminal in the project directory and run:

```bash
npm install
```

This will install:
- `express` - Web server framework
- `@google/generative-ai` - Gemini AI SDK
- `cors` - Cross-origin resource sharing
- `dotenv` - Environment variable management
- `multer` - File upload handling
- `nodemon` - Auto-restart during development

### 2. Get Your Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click **"Get API Key"** or **"Create API Key"**
4. Copy your API key

### 3. Configure Environment Variables

Open the `.env` file and add your API key:

```env
GEMINI_API_KEY=your_actual_api_key_here
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:8000
```

**Important:** Replace `your_actual_api_key_here` with your real Gemini API key!

### 4. Start the Backend Server

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

You should see:

```
🚀 SpeakX Evaluator Backend Server
📡 Server running on http://localhost:3000
🌍 CORS enabled for: http://localhost:8000
🤖 Gemini AI: ✅ Configured

📋 Available endpoints:
   GET  /health - Health check
   GET  /api/status - API status
   POST /api/evaluate - Evaluate speech
   POST /api/analyze-audio - Analyze audio file
   POST /api/feedback - Get feedback suggestions
```

### 5. Start the Frontend

In a **separate terminal**, start a local web server for the frontend:

**Using Python:**
```bash
python -m http.server 8000
```

**Using Node.js:**
```bash
npx serve -p 8000
```

**Using VS Code Live Server:**
- Right-click `index.html` → "Open with Live Server"

### 6. Open the Application

Navigate to: `http://localhost:8000`

The app will automatically detect and connect to the backend!

---

## 📡 API Endpoints

### GET `/health`
Health check endpoint

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-04T16:35:30.000Z",
  "geminiConfigured": true
}
```

### GET `/api/status`
Check API and Gemini availability

**Response:**
```json
{
  "success": true,
  "message": "SpeakX Evaluator API is running",
  "geminiAvailable": true,
  "version": "1.0.0"
}
```

### POST `/api/evaluate`
Evaluate speech with AI

**Request Body:**
```json
{
  "transcript": "User's spoken text...",
  "hasFace": true,
  "hasVoice": true,
  "audioFeatures": {
    "duration": 10,
    "hasAudio": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "mode": "Human Face + Voice",
  "evaluation": {
    "clarity": 8,
    "confidence": 7,
    "clarityFeedback": "Try to speak with more structured sentences.",
    "confidenceFeedback": "Maintain eye contact and reduce pauses.",
    "analysis": "Overall good performance with clear articulation..."
  }
}
```

### POST `/api/analyze-audio`
Analyze audio file with Gemini (multipart/form-data)

**Request:**
- Form field: `audio` (audio file)

**Response:**
```json
{
  "success": true,
  "analysis": "Detailed AI analysis of the audio..."
}
```

### POST `/api/feedback`
Get personalized feedback suggestions

**Request Body:**
```json
{
  "clarity": 8,
  "confidence": 7,
  "mode": "Human Face + Voice"
}
```

**Response:**
```json
{
  "success": true,
  "feedback": {
    "clarityTip": "Reduce filler words for better clarity.",
    "confidenceTip": "Maintain eye contact with the camera."
  }
}
```

---

## 🔧 Troubleshooting

### Backend won't start

**Error:** `Cannot find module 'express'`
- **Solution:** Run `npm install`

**Error:** `Port 3000 already in use`
- **Solution:** Change `PORT` in `.env` to another port (e.g., 3001)

### Gemini AI not working

**Warning:** `GEMINI_API_KEY not found in .env file`
- **Solution:** Add your API key to `.env` file

**Error:** `Invalid API key`
- **Solution:** Verify your API key is correct and active

**Error:** `Quota exceeded`
- **Solution:** Check your [Google AI Studio quota](https://makersuite.google.com/)

### Frontend can't connect to backend

**Error:** `Failed to fetch` or `CORS error`
- **Solution:** 
  1. Make sure backend is running on port 3000
  2. Check `FRONTEND_URL` in `.env` matches your frontend URL
  3. Verify no firewall is blocking the connection

### App works but no AI features

- The app will automatically fall back to local evaluation if backend is unavailable
- Check browser console for connection errors
- Verify backend is running: `http://localhost:3000/health`

---

## 🎯 Testing the Backend

### Test with curl

**Health check:**
```bash
curl http://localhost:3000/health
```

**Status check:**
```bash
curl http://localhost:3000/api/status
```

**Evaluate speech:**
```bash
curl -X POST http://localhost:3000/api/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "transcript": "Hello, this is a test",
    "hasFace": true,
    "hasVoice": true
  }'
```

### Test with browser

Open in browser:
- `http://localhost:3000/health`
- `http://localhost:3000/api/status`

---

## 🔐 Security Notes

1. **Never commit `.env` file** - It's already in `.gitignore`
2. **Keep your API key secret** - Don't share it publicly
3. **Use environment variables** - Never hardcode API keys
4. **Rotate keys regularly** - Generate new keys periodically
5. **Monitor usage** - Check your API usage in Google AI Studio

---

## 📊 How It Works

### Evaluation Flow

1. **Frontend** captures video and audio
2. **Face detection** runs locally with face-api.js
3. **Voice detection** analyzes audio levels
4. **User clicks "Evaluate"**
5. **Frontend** sends data to backend API
6. **Backend** calls Gemini AI with evaluation prompt
7. **Gemini** analyzes and returns scores + feedback
8. **Backend** applies mode-based rules (50% penalty, etc.)
9. **Frontend** displays results with AI-generated feedback

### Fallback Mechanism

If backend is unavailable:
- Frontend automatically detects connection failure
- Falls back to local evaluation algorithm
- Shows "Local Mode" status
- Still provides scores and generic feedback

---

## 🚀 Production Deployment

### Environment Variables for Production

```env
GEMINI_API_KEY=your_production_api_key
PORT=3000
NODE_ENV=production
FRONTEND_URL=https://your-domain.com
```

### Recommended Hosting

- **Backend:** Railway, Render, Heroku, DigitalOcean
- **Frontend:** Vercel, Netlify, GitHub Pages

### Security Enhancements

1. Add rate limiting (e.g., `express-rate-limit`)
2. Add request validation (e.g., `joi` or `zod`)
3. Enable HTTPS only
4. Add authentication if needed
5. Set up monitoring and logging

---

## 📝 Development Tips

### Auto-reload during development

```bash
npm run dev
```

This uses `nodemon` to automatically restart the server when you make changes.

### View logs

The server logs all requests:
```
2025-12-04T16:35:30.000Z - POST /api/evaluate
```

### Test different scenarios

1. Test with face + voice
2. Test with voice only
3. Test with no input
4. Test with long speeches
5. Test with different languages

---

## 🎓 Next Steps

1. ✅ Get Gemini API key
2. ✅ Install dependencies
3. ✅ Configure `.env` file
4. ✅ Start backend server
5. ✅ Start frontend server
6. ✅ Test the application
7. 🚀 Start practicing!

---

## 💡 Need Help?

- **Gemini API Docs:** https://ai.google.dev/docs
- **Express.js Docs:** https://expressjs.com/
- **Node.js Docs:** https://nodejs.org/

---

**Built with ❤️ for better communication skills**
