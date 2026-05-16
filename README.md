# Histora — Interview the Past

Histora is an AI-powered historical learning platform that lets users interact with historical events through character-based conversations. Instead of reading static textbook content, users can choose a historical event, select a perspective, ask questions, hear voice responses, view cited source evidence, and generate quizzes from curated archive notes.

Built for a hackathon MVP, Histora combines source-grounded AI, voice interaction, admin-managed content, and an immersive historical interface.

---

## ✨ Features

### Historical Event Exploration
- Browse curated historical events
- Select event-based perspectives/characters
- Explore history through guided conversations

### Source-Grounded AI Chat
- Ask questions to historical perspectives
- AI answers using curated source notes
- Responses cite source evidence
- If information is unavailable, the system avoids unsupported answers

### Voice Experience
- ElevenLabs text-to-speech support
- Male/Female voice selector
- Voice playback with animated speaking state
- Browser speech-to-text input

### Live Interview Mode
- Voice-based conversation flow
- User speaks, AI responds, voice plays back
- Designed to feel like interviewing a historical perspective

### Source Evidence
- Source cards connected to each character/event
- Citation links open original references
- Users can save/archive source cards

### Quiz Generation
- Generate MCQs from source notes
- Useful for learning, revision, and classroom demos

### User Accounts
- Email signup/login using Supabase Auth
- Normal users can explore events, chat, save conversations, and generate quizzes

### Admin Dashboard
- Admin-only dashboard
- CRUD operations for:
  - Events
  - Characters
  - Source Notes
- View users and conversation logs
- Content changes sync with Supabase

---

## 🛠️ Tech Stack

- **Frontend:** React + Vite + TypeScript
- **Styling:** Tailwind CSS
- **Animations:** Framer Motion
- **Database/Auth:** Supabase
- **AI Chat:** OpenAI API
- **Voice:** ElevenLabs API
- **Deployment:** Vercel

---