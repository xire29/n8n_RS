# Technical Documentation - Movie Recommendation System Using NLP

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Technology Stack](#technology-stack)
3. [Data Flow](#data-flow)
4. [API Reference](#api-reference)
5. [Database Schema](#database-schema)
6. [Setup & Configuration](#setup--configuration)
7. [Deployment](#deployment)
8. [Troubleshooting](#troubleshooting)

---

## System Architecture

### High-Level Overview

```
┌─────────────────┐
│  React Frontend │
│   (Chat UI)     │
└────────┬────────┘
         │ POST /webhook/chat
         ▼
┌─────────────────────────────┐
│    n8n Workflow Engine      │
│  ┌──────────────────────┐   │
│  │  AI Agent (Gemini)   │   │
│  │  - NLP Processing    │   │
│  │  - Intent Extraction │   │
│  └──────────┬───────────┘   │
│             │                │
│  ┌──────────▼───────────┐   │
│  │  Recommendation Tool │   │
│  │  - Embeddings (768d) │   │
│  │  - Vector Search     │   │
│  └──────────┬───────────┘   │
└─────────────┼───────────────┘
              │
              ▼
┌─────────────────────────────┐
│   Qdrant Vector Database    │
│  - IMDB Top 1000 Movies     │
│  - Cosine Similarity Search │
└─────────────────────────────┘
```

### Components

**Frontend**: React + TypeScript chat interface with session management
**Backend**: n8n workflows for orchestration and NLP processing
**AI**: Google Gemini for embeddings and conversational AI
**Database**: Qdrant for vector storage and similarity search

---

## Technology Stack

| Layer | Technology | Version/Model |
|-------|-----------|---------------|
| Frontend | React + TypeScript | 18.3.1 |
| Styling | Tailwind CSS | 3.4.10 |
| Build Tool | Vite | 5.4.2 |
| Workflow | n8n | Latest |
| NLP Model | Google Gemini | text-embedding-004 |
| Chat Model | Google Gemini | Chat Model |
| Vector DB | Qdrant | Cloud |
| Embeddings | 768-dimensional vectors | Cosine similarity |

---

## Data Flow

### Complete Request-Response Cycle

```
1. USER INPUT
   └─> "Suggest romantic comedies but not horror"

2. FRONTEND
   ├─> Generate/retrieve session-id (UUID)
   └─> POST /webhook/chat
       Body: { message, session-id }

3. N8N WORKFLOW
   ├─> Webhook receives request
   ├─> AI Agent (Gemini) processes query
   │   ├─> Extracts: positive_example = "romantic comedies"
   │   └─> Extracts: negative_example = "horror"
   └─> Invokes Recommendation Tool

4. RECOMMENDATION SUB-WORKFLOW
   ├─> Generate embeddings (parallel):
   │   ├─> Positive: POST Gemini API → [768 floats]
   │   └─> Negative: POST Gemini API → [768 floats]
   ├─> Merge embeddings
   ├─> Query Qdrant:
   │   POST /collections/imdb_1000_gemini/points/query
   │   Body: {
   │     "recommend": {
   │       "positive": [[embedding]],
   │       "negative": [[embedding]],
   │       "strategy": "average_vector"
   │     },
   │     "limit": 3
   │   }
   ├─> Retrieve metadata for top 3 results
   ├─> Format: [movie_name, year, description, score]
   └─> Return aggregated results

5. AI AGENT
   └─> Generate natural language response with recommendations

6. FRONTEND
   ├─> Parse response
   ├─> Render with ReactMarkdown
   └─> Save to localStorage
```

---

## API Reference

### Frontend → n8n

#### POST /webhook/chat

**Request**:
```json
{
  "message": "Suggest thriller movies from the 90s",
  "session-id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response**:
```json
{
  "output": "Here are 3 thriller recommendations from the 90s:\n\n1. **The Silence of the Lambs** (1991)..."
}
```

### n8n → Google Gemini

#### POST /v1beta/models/text-embedding-004:embedContent

**Request**:
```json
{
  "model": "models/text-embedding-004",
  "content": {
    "parts": [{ "text": "romantic comedies" }]
  }
}
```

**Response**:
```json
{
  "embedding": {
    "values": [0.013, -0.008, ..., 0.041]  // 768 floats
  }
}
```

### n8n → Qdrant

#### POST /collections/{collection}/points/query

**Request**:
```json
{
  "query": {
    "recommend": {
      "positive": [[/* 768 floats */]],
      "negative": [[/* 768 floats */]],
      "strategy": "average_vector"
    }
  },
  "limit": 3
}
```

**Response**:
```json
{
  "result": {
    "points": [
      { "id": "uuid", "score": 0.89 },
      { "id": "uuid", "score": 0.85 },
      { "id": "uuid", "score": 0.82 }
    ]
  }
}
```

---

## Database Schema

### Qdrant Collection Configuration

```json
{
  "collection_name": "imdb_1000_gemini",
  "vector_config": {
    "size": 768,
    "distance": "Cosine"
  },
  "hnsw_config": {
    "m": 16,
    "ef_construct": 100
  }
}
```

### Point Structure

```typescript
interface QdrantPoint {
  id: string;  // UUID
  vector: number[];  // 768 floats
  payload: {
    content: string;  // Movie description for embedding
    metadata: {
      movie_name: string;
      movie_release_date: string;
      movie_description: string;
    };
  };
}
```

### IMDB Dataset Mapping

| CSV Column | Qdrant Field | Purpose |
|------------|--------------|---------|
| Overview | content | Text for embedding generation |
| Series_Title | metadata.movie_name | Display name |
| Released_Year | metadata.movie_release_date | Release year |
| Overview | metadata.movie_description | Full description |

---

## Setup & Configuration

### Prerequisites

```bash
Node.js >= 18.0.0
npm >= 9.0.0
n8n instance (cloud or self-hosted)
Qdrant account
Google Gemini API key
```

### Installation Steps

#### 1. Frontend Setup

```bash
# Clone repository
git clone https://github.com/xire29/n8n_RS.git
cd n8n_RS

# Install dependencies
npm install

# Configure environment
echo "VITE_WEBHOOK_URL=https://your-n8n-instance.com/webhook/chat" > .env

# Run development server
npm run dev
```

#### 2. n8n Workflow Setup

```bash
# Import workflow
1. Open n8n dashboard
2. Click "Import from File"
3. Select n8n-workflow.json
4. Configure credentials:
   - GitHub API (for dataset)
   - Qdrant API
   - Google Gemini API
5. Activate workflow
```

#### 3. Qdrant Setup

```bash
# Create collection
curl -X PUT 'https://your-cluster.cloud.qdrant.io:6333/collections/imdb_1000_gemini' \
  -H 'api-key: YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "vectors": {
      "size": 768,
      "distance": "Cosine"
    }
  }'
```

#### 4. Data Ingestion

```bash
# Trigger data ingestion workflow in n8n
# This will:
1. Fetch imdb_top_1000.csv from GitHub
2. Generate embeddings for each movie
3. Store in Qdrant collection
```

### Key Configuration Files

#### n8n Workflow Nodes

**AI Agent System Prompt**:
```
You are a Movie Recommender Tool using a Vector Database under the hood. 
Provide top-3 movie recommendations returned by the database, ordered by 
their recommendation score, but not showing the score to the user.
```

**Workflow Tool Schema**:
```json
{
  "type": "object",
  "properties": {
    "positive_example": {
      "type": "string",
      "description": "Movie description matching user's positive preferences"
    },
    "negative_example": {
      "type": "string",
      "description": "Movie description matching user's negative preferences"
    }
  }
}
```

#### Frontend Configuration

**App.tsx Key Settings**:
```typescript
const STORAGE_KEY = 'chat_messages_v1'  // LocalStorage key
const API_ENDPOINT = '/api/webhook'      // n8n webhook endpoint

// Session management
const [sessionId, setSessionId] = useState('')
useEffect(() => {
  setSessionId(uuidv4())  // Generate on mount
}, [])
```

---

## Deployment

### Frontend Deployment (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Set environment variable
vercel env add VITE_WEBHOOK_URL production
```

### n8n Deployment (Docker)

```yaml
# docker-compose.yml
version: '3.8'
services:
  n8n:
    image: n8nio/n8n
    restart: always
    ports:
      - "5678:5678"
    environment:
      - WEBHOOK_URL=https://yourdomain.com/
      - N8N_PROTOCOL=https
    volumes:
      - ~/.n8n:/home/node/.n8n
```

```bash
docker-compose up -d
```

### Qdrant (Cloud)

Already configured - no additional deployment needed.
Use provided cluster URL and API key.

---

## Troubleshooting

### Common Issues & Solutions

#### 1. CORS Errors

**Problem**: Frontend can't connect to n8n
**Solution**:
```bash
# Add to n8n environment
N8N_CORS_ALLOW_ORIGIN=*
```

#### 2. Empty Recommendations

**Problem**: Qdrant returns no results
**Solution**:
```bash
# Verify collection has data
curl https://your-cluster.cloud.qdrant.io:6333/collections/imdb_1000_gemini \
  -H 'api-key: YOUR_API_KEY'

# Re-run data ingestion workflow
```

#### 3. Embedding Generation Fails

**Problem**: Google Gemini API errors
**Solution**:
```bash
# Verify API key
curl "https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_API_KEY"

# Check API quotas in Google Cloud Console
```

#### 4. Session Memory Not Working

**Problem**: Agent doesn't remember context
**Solution**:
```javascript
// Verify session-id is consistent
console.log('Session ID:', sessionId)

// Check Window Buffer Memory node configuration:
sessionKey: "={{ $('Webhook').item.json.body['session-id'] }}"
```

#### 5. Build Errors

**Problem**: Frontend build fails
**Solution**:
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Verify Node version
node --version  # Should be >= 18
```

### Debug Mode

**Enable Logging**:
```typescript
// Frontend (App.tsx)
const DEBUG = true

if (DEBUG) {
  console.log('Request:', { message, sessionId })
  console.log('Response:', response)
}
```

```javascript
// n8n Workflow
// Add "Edit Fields" node with:
{
  "debug_input": "={{ $json }}",
  "debug_timestamp": "={{ $now }}"
}
```

---

## Performance Notes

- **Average Response Time**: 2-5 seconds
- **Embedding Generation**: ~500ms per text (parallel processing)
- **Vector Search**: ~50ms for 1000 vectors
- **Concurrent Users**: Scales with n8n/Qdrant tier

### Optimization Tips

1. **Cache embeddings** for common queries
2. **Increase Qdrant HNSW m parameter** for better accuracy
3. **Use CDN** for frontend deployment
4. **Enable compression** on API responses

---

## Additional Resources

- **n8n Documentation**: https://docs.n8n.io
- **Qdrant API Docs**: https://qdrant.tech/documentation/
- **Google Gemini API**: https://ai.google.dev/docs
- **Project Repository**: https://github.com/xire29/n8n_RS

---

**Author**: Vansh Meghani  
**Version**: 1.0  
**Last Updated**: October 27, 2025
