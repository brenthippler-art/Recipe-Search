🍽️ Smart Recipe Search

A responsive recipe search web application that allows users to search recipes by name or ingredient, view nutritional information, 
sort results by macros, and view detailed ingredients and steps — all while securely handling API requests through a serverless proxy.

🔧 Architecture Overview

This project uses a two-part architecture to balance simplicity, security, and real-world best practices.

1. Frontend (Static Site)

Hosted on GitHub Pages
Built with HTML, CSS, and vanilla JavaScript
Handles:
  User input
  UI rendering
  Sorting and filtering
  Modals and animations
The frontend does not store or expose any API keys.

2. Backend Proxy (Serverless)

Hosted on Vercel
Implemented using Vercel Serverless Functions
Acts as a secure proxy between the frontend and the external API

Why a proxy is required
  External APIs often block browser requests due to CORS
  API keys must not be exposed in client-side JavaScript
  GitHub Pages only supports static files (no backend)

The proxy:
  Injects the API key server-side
  Forwards requests to the Spoonacular API (via APILayer)
  Returns sanitized JSON responses to the frontend
  Adds CORS headers so the browser can safely consume responses

Data Flow

User Browser
   ↓
GitHub Pages (Frontend)
   ↓
Vercel Serverless Proxy (/api/search, /api/details)
   ↓
APILayer → Spoonacular API

🧰 Tech Stack
Frontend
HTML5
CSS3
  Flexbox & Grid
  Responsive layout
  Modal UI
JavaScript (ES6+)
  Fetch API
  DOM manipulation
  Event handling
  Defensive programming (escaping HTML, error handling)

Backend / Infrastructure
Vercel Serverless Functions
APILayer – Spoonacular API
GitHub Pages (static hosting)

🔐 Security Considerations

API key is stored only in Vercel environment variables
No secrets are committed to GitHub
All API requests are routed through a backend proxy
User/API text is sanitized before inserting into the DOM to prevent XSS

▶️ How to Run Locally

Prerequisites
A modern web browser
(Optional) VS Code + Live Server extension
Frontend (UI)

Clone the repository:
  git clone https://github.com/YOUR_USERNAME/food-project.git
Open the project folder
Open index.html using:
VS Code Live Server, or
Double-clicking the file in your browser

⚠️ The frontend will not work without the proxy unless DEMO_MODE is enabled.

🚀 Deployment
Frontend
  Deployed using GitHub Pages
  Static files only (index.html, index.css, index.js, /assets)
Backend
  Deployed on Vercel
/api/search – recipe search endpoint
/api/details – recipe detail endpoint
Environment variables managed through Vercel dashboard

🧪 Error Handling & Resilience
Graceful UI errors when API is unavailable
Server-side logging for upstream API issues
Optional demo data mode for offline/backup use

📚 Educational Value
This project demonstrates:
Real-world API security practices
Separation of concerns (frontend vs backend)
CORS handling
Serverless architecture
Defensive JavaScript programming
Responsive UI design

📌 Notes for Instructors
This application intentionally uses a serverless proxy because:
GitHub Pages cannot securely store API keys
Direct browser API calls violate CORS restrictions

This mirrors production-grade web application architecture

If you
