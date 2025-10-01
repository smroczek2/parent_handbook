# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Camp Chatbot is an AI-powered chatbot widget embedded in a parent portal dashboard. It provides AI assistance for summer camps by dynamically fetching available camps from OpenAI Vector Stores. The application is built with vanilla TypeScript, Vite, and uses OpenAI's Responses API with vector search for RAG (Retrieval-Augmented Generation) functionality.

## Development Commands

- **Install dependencies**: `npm install`
- **Start dev server**: `npm run dev` (runs on port 3000, accessible at http://0.0.0.0:3000)
- **Build for production**: `npm run build`
- **Preview production build**: `npm run preview`

## Architecture

### Core Components

**index.html**: Single-page application containing both the parent portal UI and the embedded chat widget. The portal uses a grid layout with sidebar navigation and dashboard cards. The chat widget is positioned fixed in the bottom-right corner with expand/fullscreen capabilities.

**index.tsx**: Main TypeScript module handling all chat functionality:
- Fetches available camps dynamically from OpenAI Vector Stores API on initialization
- Populates camp selector dropdown with fetched camps
- Handles camp switching via dropdown selector (resets chat history on switch)
- Implements streaming responses with real-time text generation using async generators
- Implements markdown rendering for bot responses (supports bold, italic, headings, and lists)
- Manages animated "thinking" states with random rotating phrases
- Controls widget visibility, fullscreen mode, and form submission

**vite.config.ts**: Vite configuration that loads environment variables from `.env` file and exposes `OPENAI_API_KEY` to the client-side application via Vite's `define` option.

### Key Features

**Dynamic Camp Loading**: On initialization, the app fetches all available vector stores from OpenAI's Vector Stores API (`/v1/vector_stores`) and populates a dropdown selector. Each vector store represents a camp's documentation. The first camp is auto-selected by default.

**Camp Switching**: Users select a camp from the dropdown in the registration area. When switching camps:
- Chat history is cleared
- Header title updates to show selected camp name
- Vector store ID changes for RAG queries
- All chats use the same AI instructions but search different documentation

**Markdown Rendering**: Bot responses support:
- `**bold**` text
- `*italic*` text
- `### Headings`
- Bulleted lists with `*` or `-`

**Animated Thinking State**: Shows rotating random phrases during API calls with a wave animation effect applied to each character. Automatically replaced by streaming response once text generation begins.

**Streaming Responses**: Bot responses stream in real-time character-by-character using OpenAI's Server-Sent Events (SSE) API, providing immediate feedback to users.

## API Integration

The chatbot uses two OpenAI API endpoints:

**Vector Stores API**: `https://api.openai.com/v1/vector_stores`
- Used to fetch available camps on initialization
- Requires `OpenAI-Beta: assistants=v2` header
- Returns list of vector stores with id and name

**Responses API**: `https://api.openai.com/v1/responses`
- Used for chat interactions with streaming responses
- Model: `gpt-5-mini` with low reasoning effort for faster responses
- Request format (`POST`):
  - `model`: "gpt-5-mini"
  - `input`: User's question
  - `instructions`: AI instructions for camp assistant context
  - `stream`: true (enables SSE streaming)
  - `reasoning.effort`: "low" (optimizes for speed)
  - `tools`: File search tool with selected camp's vector store ID and max 20 results

**Response format**: Server-Sent Events (SSE) stream with events:
- `response.output_item.delta` - Contains text deltas in delta.content array
- `response.output_text.delta` - Contains text deltas in delta field
- `content_block.delta` - Alternative format with delta.text field

## Deployment

The app is configured for **Vercel deployment** with serverless functions for secure API key handling.

**API Routes** (in `api/` directory):
- `api/vector-stores.ts` - Fetches available camps from OpenAI Vector Stores API
- `api/chat.ts` - Handles chat streaming with OpenAI Responses API

**Environment Variable Required**:
- `OPENAI_API_KEY` - Set in Vercel dashboard under Settings → Environment Variables

**Deployment Steps**: See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions.

## Important Notes

- No React or other frameworks are used - this is vanilla TypeScript with DOM manipulation
- All styling is inline in `index.html` using CSS custom properties for theming (purple/dark theme)
- TypeScript is configured with `jsx: "react-jsx"` but JSX is not actually used in the codebase
- The project includes path alias `@/*` pointing to the root directory
- Streaming implementation uses async generators (`async function*`) for incremental text rendering
- API key is kept secure on server-side via Vercel serverless functions (never exposed to client)
- Vector stores must be created separately in OpenAI and populated with camp documentation files
- Local development: API routes won't work locally (only on Vercel). For local dev, you'd need to run a dev server or temporarily use direct OpenAI calls
