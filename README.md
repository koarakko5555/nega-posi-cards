# Beyond Anxiety Cards

Beyond Anxiety Cards is a web app that helps users externalize anxiety into a tarot‑inspired card, then convert it into a small, concrete action. It generates a negative card (anxiety), a positive card (action direction), and allows the user to register an action to a calendar checklist.

## Key Features
- Anxiety input → negative/positive cards + action
- Image generation (Imagen) for card visuals
- Action registration to calendar checklist
- History-based gallery (negative/positive paired)
- “Your current outline” image summarizing recent cards
- Google login + anonymous usage for quick start

## Tech Stack
- Next.js (App Router)
- Firebase Auth + Firestore
- Google Cloud (Vertex AI + Cloud Storage)
- Cloud Run compatible

## Architecture (High‑Level)
1. User submits anxiety text
2. Gemini generates card JSON + image prompts
3. Imagen generates images and stores in GCS
4. Firestore stores cards, calendar tasks, and self-image summaries

## Environment Variables
Create `.env.local` with the following:

```
# Google Cloud / Vertex AI
GOOGLE_CLOUD_PROJECT=your-gcp-project
GOOGLE_CLOUD_LOCATION=asia-northeast1
VERTEX_AI_MODEL_GEMINI=gemini-2.5-flash
VERTEX_AI_MODEL_IMAGEN=imagen-4.0-generate-001
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
GCS_BUCKET=your-gcs-bucket

# Firestore
FIRESTORE_COLLECTION=cards
FIRESTORE_DATABASE_ID=(default)
FIREBASE_PROJECT_ID=your-firebase-project-id

# Firebase Web SDK
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# Feature flags
MOCK_GENERATION=false
```

## Local Development
```
npm install
npm run dev
```

## Build
```
npm run build
```

## Authentication
- Google login supported
- Anonymous login is used automatically for non‑logged‑in users
- Server APIs validate Firebase ID tokens

## API Endpoints (MVP)
- `POST /api/generate` – Generate card JSON
- `POST /api/images` – Generate Imagen assets
- `POST /api/select-image` – Save selected negative image
- `POST /api/register` – Register action to calendar
- `GET /api/calendar` – Calendar items for month
- `POST /api/checklist` – Toggle checklist completion
- `POST /api/calendar-task` – Add manual task
- `POST /api/task-update` / `POST /api/task-delete` / `POST /api/task-image`
- `GET /api/history` – Recent cards (public or private)
- `POST /api/self-image` / `GET /api/self-image` – Current outline image

## Deployment Notes
- The app is Cloud Run compatible (Node.js runtime)
- Enable APIs in GCP:
  - Vertex AI API
  - Firestore API
  - Cloud Storage
- Firestore indexes are required for history and self_images queries

## License
MIT
