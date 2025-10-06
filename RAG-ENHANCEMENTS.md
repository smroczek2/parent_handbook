# RAG Chatbot Enhancements

This document describes the two major enhancements added to improve the RAG chatbot's accuracy and safety.

## Feature 1: Query Transformation

### Purpose
Converts casual user questions into optimized search queries for better vector database retrieval.

### How It Works

**API Endpoint**: `/api/transform-query.ts`

- Uses GPT-5-nano for fast query transformation (<500ms)
- Considers conversation history for context-aware transformations
- Falls back to original question if transformation fails

**Examples**:
```
User: "what time"
Transformed: "camp start time daily schedule"

User: "packing list"
Transformed: "items to pack for camp"

User: "how about pickup?" (with history about dropoff)
Transformed: "camp pickup time end of day"
```

### Implementation Details

1. **Frontend** ([index.tsx](index.tsx)):
   - Tracks conversation history (last 6 messages)
   - Calls transform API before sending to RAG
   - Uses transformed query for vector search
   - Logs transformations to console for debugging

2. **Backend** ([api/transform-query.ts](api/transform-query.ts)):
   - Accepts: `question` and optional `conversationHistory`
   - Returns: `transformedQuery`
   - Uses simple prompt engineering to create search-optimized queries

### Testing Query Transformation

Open browser console and look for logs:
```
Query transformed: "what time" → "camp start time daily schedule"
```

## Feature 2: Custom Instructions (Guardrails)

### Purpose
Ensures the chatbot ALWAYS follows camp-specific safety rules and behavioral guidelines, especially for critical topics like allergies, medical issues, and emergencies.

### How It Works

**Storage**: Each camp has a `custom-instructions.md` file in their vector store

**Loading**:
- Custom instructions are fetched once per camp and cached in memory
- Instructions are injected at the TOP of the system prompt (highest priority)

**Priority Order**:
```
1. CUSTOM INSTRUCTIONS (Highest - safety rules)
2. Regular Instructions (Base chatbot behavior)
3. Personalization Context (Camper details)
```

### Implementation Details

1. **Load Custom Instructions** ([api/load-custom-instructions.ts](api/load-custom-instructions.ts)):
   - Searches for `custom-instructions.md` in the camp's vector store
   - Returns the complete content
   - Returns empty string if file doesn't exist

2. **Inject Instructions** ([api/chat.ts](api/chat.ts)):
   - Prepends custom instructions (with an explicit safety header) to regular instructions
   - Explicitly tells the model to check safety rules first and obey them verbatim without adding extra details
   - Uses separator lines for clear prioritization
   - Passes combined instructions to OpenAI API

3. **Frontend Caching** ([index.tsx](index.tsx)):
   - Caches custom instructions per `vectorStoreId`
   - Pre-loads instructions when switching camps
   - Clears conversation history when switching camps

### Creating Custom Instructions

**Through the UI (Recommended)**:

1. **Navigate to the dashboard** and select your camp
2. **Find "Custom Safety Instructions"** section (with shield icon)
3. **Click "Load Template"** to get started with a pre-formatted template
4. **Replace placeholders** like `[NURSE_EMAIL]`, `[HEALTH_EMAIL]`, etc.
5. **Click "Save Instructions"** - They're automatically uploaded to your camp's vector store
6. **Verify the green status box** shows "Custom instructions active"

See [CUSTOM-INSTRUCTIONS-GUIDE.md](CUSTOM-INSTRUCTIONS-GUIDE.md) for detailed user instructions.

**Through the API (Advanced)**:

1. **Use the template**: [custom-instructions-template.md](custom-instructions-template.md)
2. **Replace placeholders** with actual contact information
3. **POST to `/api/upload-custom-instructions`** with:
   ```json
   {
     "vectorStoreId": "vs_abc123",
     "customInstructions": "# CUSTOM INSTRUCTIONS..."
   }
   ```

**Test critical scenarios**:
- Ask about allergies → Should escalate to nurse
- Ask about medication → Should escalate to health center
- Ask about emergencies → Should provide emergency contact

### Example Custom Instructions Behavior

**Test Case 1: Allergy Question**
```
User: "My child has a peanut allergy, what should I do?"

Expected Response:
"For allergy and dietary questions, please contact our camp nurse at
nurse@camp.com or (555) 123-4567. They have access to your camper's
medical forms and can provide personalized guidance."
```

**Test Case 2: Medication Question**
```
User: "Can I send Tylenol with my camper?"

Expected Response:
"All medication questions must be directed to our Health Center.
Please contact them at health@camp.com or (555) 123-4568 before camp
starts to discuss your camper's medication needs."
```

## Complete Chat Flow

```
1. User enters question
   ↓
2. Transform query (/api/transform-query.ts)
   - Input: Original question + conversation history
   - Output: Optimized search query
   ↓
3. Load custom instructions (cached per session)
   - Retrieve from camp's vector store
   - Cache for subsequent queries
   ↓
4. Build final instructions (priority order)
   a) Custom Instructions (HIGHEST)
   b) Regular Instructions
   c) Camper Personalization Context
   ↓
5. RAG Query (/api/chat.ts)
   - Search with: transformed query
   - Instructions: custom instructions injected at top
   ↓
6. Stream response to user
   ↓
7. Add to conversation history
```

## Performance

- **Query Transformation**: <500ms (GPT-5-nano)
- **Custom Instructions Loading**: <200ms (cached after first load)
- **Total Overhead**: <1 second
- **Caching Strategy**: In-memory cache per browser session, keyed by `vectorStoreId`

## API Endpoints

### New Endpoints

1. **POST /api/transform-query**
   ```json
   Request:
   {
     "question": "what time",
     "conversationHistory": ["User: ...", "Assistant: ..."]
   }

   Response:
   {
     "originalQuestion": "what time",
     "transformedQuery": "camp start time daily schedule"
   }
   ```

2. **POST /api/load-custom-instructions**
   ```json
   Request:
   {
     "vectorStoreId": "vs_abc123"
   }

   Response:
   {
     "customInstructions": "# CUSTOM INSTRUCTIONS...\n\n..."
   }
   ```

3. **POST /api/upload-custom-instructions**
   ```json
   Request:
   {
     "vectorStoreId": "vs_abc123",
     "customInstructions": "# CUSTOM INSTRUCTIONS - HIGHEST PRIORITY\n\n..."
   }

   Response:
   {
     "success": true,
     "message": "Custom instructions uploaded successfully",
     "fileId": "file-abc123"
   }
   ```

   **Note**: This endpoint automatically:
   - Searches for existing `custom-instructions.md` in the vector store
   - Deletes old version if it exists
   - Uploads new version as `custom-instructions.md`
   - Adds the file to the vector store

### Modified Endpoint

**POST /api/chat**
```json
Request:
{
  "message": "camp start time daily schedule",  // Transformed query
  "vectorStoreId": "vs_abc123",
  "instructions": "You are a helpful...",
  "camperContext": "...",
  "customInstructions": "# CUSTOM INSTRUCTIONS..."  // NEW
}
```

## Testing Checklist

### Query Transformation
- [ ] Test with vague questions ("what time", "how about")
- [ ] Test with conversation context
- [ ] Verify console logs show transformations
- [ ] Verify fallback to original on API failure

### Custom Instructions
- [ ] Upload `custom-instructions.md` to a test camp's vector store
- [ ] Verify cache logs in console
- [ ] Test allergy question → Should escalate to nurse
- [ ] Test medication question → Should escalate to health center
- [ ] Test emergency question → Should provide emergency contact
- [ ] Switch camps and verify different instructions load
- [ ] Switch back and verify cached instructions are used

### Integration
- [ ] Test complete flow end-to-end
- [ ] Verify conversation history builds correctly
- [ ] Verify history resets when switching camps
- [ ] Verify history resets on "reset conversation"
- [ ] Test with camper personalization enabled
- [ ] Check performance (should be <1s overhead)

## Configuration

### Environment Variables
No new environment variables required. Uses existing `OPENAI_API_KEY`.

### File Structure
```
/api/
  ├── chat.ts                          # Modified
  ├── transform-query.ts               # NEW
  ├── load-custom-instructions.ts      # NEW
  ├── vector-stores.ts
  ├── extract-segments.ts
  └── suggest-questions.ts

/custom-instructions-template.md       # NEW - Template for camps

index.tsx                              # Modified
```

## Future Enhancements

1. **Persistent Cache**: Store custom instructions in localStorage for faster loading
2. **Admin Dashboard**: UI for camps to edit custom instructions without uploading files
3. **Validation**: Automated testing to ensure critical rules are being followed
4. **Metrics**: Track which guardrails are triggered most often
5. **Versioning**: Track changes to custom instructions over time

## Support

For questions or issues:
- Check console logs for transformation and caching activity
- Verify `custom-instructions.md` exists in vector store
- Test API endpoints individually using browser dev tools
- Review [CLAUDE.md](CLAUDE.md) for overall architecture
