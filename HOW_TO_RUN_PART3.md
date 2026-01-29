# Part 3: Automatic Academic Content Generation

This feature generates lecture notes, slides, and lab code for a given topic using RAG and Gemini.

## 1. Setup

Ensure the backend has the necessary dependencies. The feature uses standard libraries + existing dependencies (`langchain`, `google-generativeai`).

No new pip installation is required if the existing backend is set up.

## 2. Running the System

### Backend
1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Run the server:
   ```bash
   python main.py
   ```
   (Or `uvicorn main:app --reload`)

### Frontend
1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Start the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

## 3. Demo Instructions

1. Open your browser to `http://localhost:3000/generate`.
2. Enter a topic (e.g., "Neural Networks", "History of Rome", "Python Basics").
3. Select an audience (e.g., "Undergraduate").
4. Click **Generate Content**.
5. Wait for the generation (processing RAG + Wiki + LLM).
6. View the results in the three tabs:
   - **Lecture Notes**: Comprehensive markdown notes.
   - **Slides**: Click "Next" to navigate through the generated slide deck.
   - **Lab Code**: View the executable code snippet.

## 4. Architecture

- **Endpoint**: `POST /api/generate`
- **Logic**:
  1. **RAG**: Searches local documents for `topic`.
  2. **Wiki**: Fetches Wikipedia summary (via `urllib`).
  3. **LLM**: Gemini Pro generates strict JSON with `notes`, `slides`, `lab_code`.
- **Frontend**: Next.js page with `react-markdown` for rendering.
