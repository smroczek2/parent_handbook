# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Camp Chatbot is a dual AI-powered chatbot widget embedded in a parent portal dashboard. It provides AI assistance for two summer camps: Camp Takajo and PSDC. The application is built with vanilla TypeScript, Vite, and uses OpenAI's API with vector search for chat functionality.

## Development Commands

- **Install dependencies**: `npm install`
- **Start dev server**: `npm run dev` (runs on port 3000, accessible at http://0.0.0.0:3000)
- **Build for production**: `npm run build`
- **Preview production build**: `npm run preview`

## Architecture

### Core Components

**index.html**: Single-page application containing both the parent portal UI and the embedded chat widget. The portal uses a grid layout with sidebar navigation and dashboard cards. The chat widget is positioned fixed in the bottom-right corner with expand/fullscreen capabilities.

**index.tsx**: Main TypeScript module handling all chat functionality:
- Manages two separate chatbot instances (Takajo and PSDC) with different vector stores
- Handles chatbot switching via selector buttons
- Implements streaming responses with real-time text generation
- Implements markdown rendering for bot responses (supports bold, italic, headings, and lists)
- Manages animated "thinking" states with random phrases
- Controls widget visibility, fullscreen mode, and form submission

**vite.config.ts**: Vite configuration that loads environment variables and exposes `OPENAI_API_KEY` to the application.

### Key Features

**Dual Chatbot System**: The widget can switch between two different chatbots with separate:
- Vector store IDs (defined in `VECTOR_STORE_IDS`)
- AI instructions (defined in `INSTRUCTIONS`)
- Welcome messages (defined in `WELCOME_MESSAGES`)
- Header titles (defined in `HEADER_TITLES`)
- Chat history (resets when switching between chatbots)

**Markdown Rendering**: Bot responses support:
- `**bold**` text
- `*italic*` text
- `### Headings`
- Bulleted lists with `*` or `-`

**Animated Thinking State**: Shows rotating random phrases during API calls with a wave animation effect applied to each character. Automatically replaced by streaming response once text generation begins.

**Streaming Responses**: Bot responses stream in real-time character-by-character using OpenAI's Server-Sent Events (SSE) API, providing immediate feedback to users.

## API Integration

The chatbot uses OpenAI's API endpoint: `https://api.openai.com/v1/responses`

**Model**: GPT-5-mini with low reasoning effort for faster responses

**Request format**: `POST` with:
- `model`: "gpt-5-mini"
- `input`: User's question
- `instructions`: Camp-specific instructions for context
- `stream`: true (enables SSE streaming)
- `reasoning.effort`: "low" (optimizes for speed)
- `tools`: File search with vector store IDs and max 20 results

**Response format**: Server-Sent Events (SSE) stream with events:
- `response.output_item.delta` - Contains text deltas in delta.content array
- `response.output_text.delta` - Contains text deltas in delta field
- `content_block.delta` - Alternative format with delta.text field

**Environment Variables Required**:
- `OPENAI_API_KEY` - OpenAI API authentication key
- `TAKAJO_VECTOR_STORE_ID` - Vector store ID for Takajo camp documentation
- `PSDC_VECTOR_STORE_ID` - Vector store ID for PSDC camp documentation

## Important Notes

- No React or other frameworks are used - this is vanilla TypeScript with DOM manipulation
- All styling is inline in index.html using CSS custom properties for theming
- TypeScript is configured with `jsx: "react-jsx"` but JSX is not actually used in the codebase
- The project includes path alias `@/*` pointing to the root directory
- Environment variables must be configured in `.env` file (not committed to git)
- Streaming implementation uses async generators for incremental text rendering
