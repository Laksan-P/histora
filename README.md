# Histora — Interview the Past

Histora is an AI-powered interactive platform that enables users to explore historical events through immersive, perspective-driven conversations. By combining curated source material with intelligent response generation and voice narration, Histora transforms passive learning into an engaging and evidence-based experience.

---

## Overview

Traditional approaches to learning history are often static and one-dimensional. Histora addresses this limitation by allowing users to:

- Engage with multiple perspectives within a single historical event  
- Interact with AI-generated responses grounded in verified source material  
- Experience history through conversational and voice-enabled interfaces  

The platform is designed to make historical understanding more accessible, interactive, and meaningful.

---

## Key Features

### Event Exploration
Users can browse a curated collection of historical events, each representing a significant moment in time.

### Perspective-Based Interaction
Each event includes multiple perspectives (e.g., witnesses, leaders, civilians), allowing users to explore different viewpoints and interpretations.

### AI-Powered Conversations
Users can ask natural language questions and receive contextual responses generated using structured historical data.

### Source-Grounded Responses
All responses are based on curated source notes, ensuring accuracy and reducing the risk of unsupported or fabricated information.

### Voice Integration
Responses can be delivered through voice, enhancing immersion and accessibility.

### Interactive Quiz Generation
Users can generate quizzes based on their interactions to reinforce learning outcomes.

---

## System Architecture

Histora is built using a modern, scalable technology stack:

- **Frontend:** React (Vite)
- **Backend:** Supabase (PostgreSQL, Authentication, APIs)
- **AI Integration:** OpenAI (context-driven response generation)
- **Voice Processing:** ElevenLabs (text-to-speech)
- **Deployment:** Vercel

---

## Application Flow

1. **Event Selection**  
   Users select a historical event from the available catalog.

2. **Perspective Selection**  
   A perspective (character) is chosen to guide the interaction.

3. **Interactive Session**  
   Users engage in a conversational interface to explore the event.

4. **Response Generation**  
   AI responses are generated using:
   - Perspective-specific context  
   - Linked source notes  

5. **Voice Output (Optional)**  
   Responses are narrated using voice synthesis.

6. **Source Evidence Review**  
   Users can view supporting source notes associated with responses.

---

## Administrative Dashboard

Histora includes a dedicated administrative interface that enables full control over the platform’s content and behavior.

### Core Capabilities

- **Event Management**  
  Create, update, and organize historical events.

- **Character (Perspective) Management**  
  Define perspectives, including tone, role, and narrative context.

- **Source Note Management**  
  Add and maintain citations that ground AI responses.

- **User and Activity Monitoring**  
  Track interactions and system usage.

This structure ensures that all AI-generated content remains controlled, traceable, and aligned with curated data.

---

## Example Use Case

**Event:** Titanic Sinking (1912)  
**Perspective:** Third-Class Passenger  

Through this perspective, users can explore the event from the viewpoint of individuals with limited access to resources, providing insight into social conditions, evacuation challenges, and lived experiences during the disaster.

---

## Project Objectives

- Enhance engagement with historical content  
- Provide multi-perspective understanding of events  
- Ensure reliability through source-grounded AI responses  
- Integrate voice and conversational interfaces for improved accessibility  

---

## Future Enhancements

- Expansion of historical event catalog  
- Real-time conversational voice interaction  
- Classroom and educational integrations  
- Advanced analytics for learning outcomes  
- Support for immersive technologies (AR/VR)

---

## Installation and Setup

```bash
# Clone the repository
git clone https://github.com/your-repo/histora.git

# Navigate to the project directory
cd histora

# Install dependencies
npm install

# Start development server
npm run dev