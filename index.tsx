
interface VectorStore {
    id: string;
    name: string;
    created_at: number;
}

interface Camp {
    id: string;
    name: string;
    vectorStoreId: string;
}

interface SegmentOption {
    label: string;
    values: string[];
}

interface CamperProfile {
    id: string;
    name: string;
    segments: { [key: string]: string };
}

interface FileSearchResult {
    filename: string;
    score: number;
    text: string;
    file_id: string;
    vector_store_id: string;
    attributes: Record<string, unknown>;
}

document.addEventListener('DOMContentLoaded', () => {
    const chatContainer = document.getElementById('chat-container') as HTMLDivElement;
    const inputForm = document.getElementById('input-area') as HTMLFormElement;
    const messageInput = document.getElementById('message-input') as HTMLInputElement;
    const sendButton = document.getElementById('send-button') as HTMLButtonElement;
    const launcher = document.getElementById('chat-launcher') as HTMLButtonElement;
    const widgetContainer = document.getElementById('chat-widget-container') as HTMLDivElement;
    const expandButton = document.getElementById('expand-button') as HTMLButtonElement;
    const resetButton = document.getElementById('reset-button') as HTMLButtonElement;
    const headerTitle = document.getElementById('header-title') as HTMLHeadingElement;
    const headerSubtitle = document.getElementById('header-subtitle') as HTMLParagraphElement;
    const campSelector = document.getElementById('camp-selector') as HTMLSelectElement;
    const personalizationSection = document.getElementById('personalization-section') as HTMLDivElement;
    const segmentsLoading = document.getElementById('segments-loading') as HTMLDivElement;
    const campersContainer = document.getElementById('campers-container') as HTMLDivElement;
    const addCamperButton = document.getElementById('add-camper-button') as HTMLButtonElement;
    const suggestedQuestionsContainer = document.getElementById('suggested-questions') as HTMLDivElement;
    const citationsContainer = document.getElementById('citations-container') as HTMLDivElement;
    const customInstructionsSection = document.getElementById('custom-instructions-section') as HTMLDivElement;
    const customInstructionsToggle = document.getElementById('custom-instructions-toggle') as HTMLButtonElement;
    const customInstructionsContent = document.getElementById('custom-instructions-content') as HTMLDivElement;
    const customInstructionsIndicator = document.getElementById('custom-instructions-indicator') as HTMLSpanElement;
    const customInstructionsChevron = document.getElementById('custom-instructions-chevron') as unknown as SVGElement;
    const customInstructionsInput = document.getElementById('custom-instructions-input') as HTMLTextAreaElement;
    const saveCustomInstructionsButton = document.getElementById('save-custom-instructions-button') as HTMLButtonElement;
    const deleteCustomInstructionsButton = document.getElementById('delete-custom-instructions-button') as HTMLButtonElement;
    const loadTemplateButton = document.getElementById('load-template-button') as HTMLButtonElement;
    const customInstructionsSaveStatus = document.getElementById('custom-instructions-save-status') as HTMLDivElement;

    // Use Vercel serverless functions instead of direct OpenAI API calls
    const CHAT_API_ENDPOINT = "/api/chat";
    const VECTOR_STORES_API_ENDPOINT = "/api/vector-stores";
    const EXTRACT_SEGMENTS_API_ENDPOINT = "/api/extract-segments";
    const SUGGEST_QUESTIONS_API_ENDPOINT = "/api/suggest-questions";
    const TRANSFORM_QUERY_API_ENDPOINT = "/api/transform-query";
    const LOAD_CUSTOM_INSTRUCTIONS_API_ENDPOINT = "/api/load-custom-instructions";
    const UPLOAD_CUSTOM_INSTRUCTIONS_API_ENDPOINT = "/api/upload-custom-instructions";
    const DELETE_CUSTOM_INSTRUCTIONS_API_ENDPOINT = "/api/delete-custom-instructions";

    const WELCOME_MESSAGE = "Hi! I can help answer questions about your selected camp. What would you like to know?";
    const INSTRUCTIONS = "You are a helpful AI assistant for a summer camp. Your role is to help parents find answers to their questions about the camp by searching through the camp's documentation. Be friendly, informative, and concise. Focus on providing accurate information from the documentation. If a question cannot be answered from the available documents, politely let the parent know, this includes incomplete questions or questions the just contain random characters or a period. \n\nIMPORTANT: Answer ONLY the specific question asked. Do NOT suggest follow-up questions, additional actions, or offer to help with anything else. Simply provide the requested information and end your response there.";

    let availableCamps: Camp[] = [];
    let activeCamp: Camp | null = null;
    let thinkingInterval: number | null = null;
    let availableSegments: SegmentOption[] = [];
    let campers: CamperProfile[] = [];
    let nextCamperId = 1;
    let hasUserSentMessage = false;
    let currentQuestionsFetchController: AbortController | null = null;
    let conversationHistory: string[] = [];
    let cachedCustomInstructions: { [vectorStoreId: string]: string } = {};
    let isInitializing = true;

    // Mock camper names for proof of concept
    const MOCK_CAMPER_NAMES = ['Alex Thompson', 'Jordan Martinez', 'Taylor Kim', 'Casey Johnson'];

    function generateCamperId(): string {
        return `camper-${nextCamperId++}`;
    }

    function extractFirstName(fullName: string): string {
        return fullName.split(' ')[0];
    }

    async function fetchVectorStores(): Promise<Camp[]> {
        try {
            const response = await fetch(VECTOR_STORES_API_ENDPOINT, {
                method: "GET"
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch vector stores: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const vectorStores: VectorStore[] = data.data || [];

            return vectorStores.map(vs => ({
                id: vs.id,
                name: vs.name || vs.id,
                vectorStoreId: vs.id
            }));
        } catch (error) {
            console.error("Error fetching vector stores:", error);
            return [];
        }
    }

    async function fetchSegments(vectorStoreId: string): Promise<SegmentOption[]> {
        // Check if this is Camp Colorado and return hardcoded segments
        const campName = availableCamps.find(c => c.vectorStoreId === vectorStoreId)?.name.toLowerCase();
        if (campName && campName.includes('colorado')) {
            return [
                {
                    label: 'Session',
                    values: ['Full Summer', 'First Half', 'Second Half']
                },
                {
                    label: 'Age',
                    values: ['8-10', '11-13', '14-17']
                }
            ];
        }

        // For other camps, fetch dynamically from API
        try {
            const response = await fetch(EXTRACT_SEGMENTS_API_ENDPOINT, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ vectorStoreId })
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch segments: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return data.segments || [];
        } catch (error) {
            console.error("Error fetching segments:", error);
            return [];
        }
    }

    async function loadCustomInstructions(vectorStoreId: string): Promise<string> {
        // Check if we already loaded this camp's instructions
        if (cachedCustomInstructions[vectorStoreId]) {
            console.log(`Using cached custom instructions for ${vectorStoreId}`);
            return cachedCustomInstructions[vectorStoreId];
        }

        console.log(`Fetching custom instructions for ${vectorStoreId}`);

        try {
            const response = await fetch(LOAD_CUSTOM_INSTRUCTIONS_API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vectorStoreId })
            });

            if (!response.ok) {
                console.warn('Failed to load custom instructions');
                return '';
            }

            const data = await response.json();
            const instructions = data.customInstructions || '';

            // Cache for this specific camp (keyed by vectorStoreId)
            cachedCustomInstructions[vectorStoreId] = instructions;

            console.log(`Cached custom instructions for ${vectorStoreId}`, instructions ? '(content loaded)' : '(empty)');

            // Update UI status
            updateCustomInstructionsUI(instructions);

            return instructions;
        } catch (error) {
            console.error('Error loading custom instructions:', error);
            return '';
        }
    }

    function updateCustomInstructionsUI(instructions: string) {
        if (instructions && instructions.trim()) {
            customInstructionsIndicator.style.display = 'inline-flex';
            customInstructionsInput.value = instructions;
        } else {
            customInstructionsIndicator.style.display = 'none';
            customInstructionsInput.value = '';
        }
    }

    function toggleCustomInstructions() {
        const isExpanded = customInstructionsContent.style.display !== 'none';

        if (isExpanded) {
            customInstructionsContent.style.display = 'none';
            customInstructionsChevron.style.transform = 'rotate(0deg)';
        } else {
            customInstructionsContent.style.display = 'block';
            customInstructionsChevron.style.transform = 'rotate(180deg)';
        }
    }

    async function saveCustomInstructions() {
        if (!activeCamp) {
            showSaveStatus('Please select a camp first', 'error');
            return;
        }

        const instructions = customInstructionsInput.value.trim();

        if (!instructions) {
            showSaveStatus('Please enter custom instructions', 'error');
            return;
        }

        saveCustomInstructionsButton.disabled = true;
        saveCustomInstructionsButton.textContent = 'Saving...';

        try {
            const response = await fetch(UPLOAD_CUSTOM_INSTRUCTIONS_API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    vectorStoreId: activeCamp.vectorStoreId,
                    customInstructions: instructions
                })
            });

            if (!response.ok) {
                throw new Error('Failed to save custom instructions');
            }

            // Invalidate cache for this camp
            delete cachedCustomInstructions[activeCamp.vectorStoreId];

            // Reload custom instructions to update cache
            await loadCustomInstructions(activeCamp.vectorStoreId);

            showSaveStatus('Custom instructions saved successfully!', 'success');

        } catch (error) {
            console.error('Error saving custom instructions:', error);
            showSaveStatus('Failed to save custom instructions', 'error');
        } finally {
            saveCustomInstructionsButton.disabled = false;
            saveCustomInstructionsButton.textContent = 'Save Instructions';
        }
    }

    function showSaveStatus(message: string, type: 'success' | 'error') {
        customInstructionsSaveStatus.textContent = message;
        customInstructionsSaveStatus.style.display = 'block';
        customInstructionsSaveStatus.style.backgroundColor = type === 'success' ? '#10b981' : '#ef4444';
        customInstructionsSaveStatus.style.color = 'white';

        setTimeout(() => {
            customInstructionsSaveStatus.style.display = 'none';
        }, 3000);
    }

    async function deleteCustomInstructions() {
        if (!activeCamp) {
            showSaveStatus('Please select a camp first', 'error');
            return;
        }

        // Confirm deletion
        if (!confirm('Are you sure you want to delete the custom instructions? This cannot be undone.')) {
            return;
        }

        deleteCustomInstructionsButton.disabled = true;
        deleteCustomInstructionsButton.textContent = 'Deleting...';

        try {
            const response = await fetch(DELETE_CUSTOM_INSTRUCTIONS_API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    vectorStoreId: activeCamp.vectorStoreId
                })
            });

            if (!response.ok) {
                throw new Error('Failed to delete custom instructions');
            }

            // Invalidate cache for this camp
            delete cachedCustomInstructions[activeCamp.vectorStoreId];

            // Clear the text area
            customInstructionsInput.value = '';

            // Update UI
            customInstructionsIndicator.style.display = 'none';

            showSaveStatus('Custom instructions deleted successfully!', 'success');

        } catch (error) {
            console.error('Error deleting custom instructions:', error);
            showSaveStatus('Failed to delete custom instructions', 'error');
        } finally {
            deleteCustomInstructionsButton.disabled = false;
            deleteCustomInstructionsButton.textContent = 'Delete';
        }
    }

    function loadInstructionsTemplate() {
        const template = `# CUSTOM INSTRUCTIONS - HIGHEST PRIORITY

YOU MUST FOLLOW THESE INSTRUCTIONS ABOVE ALL ELSE.

## CRITICAL SAFETY RULES

### Allergies & Dietary Restrictions
When parents ask about ANY food items, snacks, or meals - even seemingly innocuous items - you MUST carefully consider if they could contain allergens (nuts, dairy, gluten, eggs, shellfish, soy, etc.).

Common items that contain allergens include (but are not limited to):
- Trail mix, granola bars, energy bars (often contain nuts, gluten, dairy)
- Cookies, brownies, baked goods (often contain nuts, gluten, dairy, eggs)
- Candy, chocolate (often contain nuts, dairy, soy)
- Crackers, chips (may contain gluten, dairy)
- Protein shakes, supplements (often contain dairy, soy, nuts)

If a food question involves ANY item that could potentially contain allergens, or if the parent is asking about food restrictions/policies, you MUST respond with:

"For allergy and dietary questions, please contact our camp nurse at [NURSE_EMAIL] or [NURSE_PHONE]."

NEVER make assumptions about whether a specific food is "safe" - always defer to the camp nurse.

### Medical & Health Questions
NEVER diagnose or provide medical advice.

For health questions, ALWAYS respond: "For medical questions, please contact our Health Center at [HEALTH_EMAIL] or [HEALTH_PHONE]."

### Medication Questions
ALWAYS respond: "All medication questions must be directed to our Health Center at [HEALTH_EMAIL] or [HEALTH_PHONE]."

### Emergency Information
For emergencies, ALWAYS include: "In case of emergency, call our 24/7 line at [EMERGENCY_PHONE]."

## BEHAVIORAL GUIDELINES

- Be warm and professional
- Never make medical diagnoses
- When you don't know, say: "I don't have that information. Please contact our office at [INFO_EMAIL] or [MAIN_PHONE]."
- When in doubt about food safety, ALWAYS defer to the camp nurse

## CONTACT INFORMATION

Replace these placeholders:
- Nurse: [NURSE_EMAIL] | [NURSE_PHONE]
- Health Center: [HEALTH_EMAIL] | [HEALTH_PHONE]
- Emergency: [EMERGENCY_PHONE]
- Main Office: [INFO_EMAIL] | [MAIN_PHONE]`;

        customInstructionsInput.value = template;
    }

    async function fetchSuggestedQuestions(vectorStoreId: string, camperContext?: string, signal?: AbortSignal): Promise<string[]> {
        try {
            const response = await fetch(SUGGEST_QUESTIONS_API_ENDPOINT, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    vectorStoreId,
                    camperContext: camperContext || ''
                }),
                signal
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch suggested questions: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return data.questions || [];
        } catch (error) {
            // Don't log abort errors - they're expected
            if (error instanceof Error && error.name === 'AbortError') {
                return [];
            }
            console.error("Error fetching suggested questions:", error);
            return [];
        }
    }

    function renderSuggestedQuestions(questions: string[]) {
        if (questions.length === 0 || hasUserSentMessage) {
            suggestedQuestionsContainer.style.display = 'none';
            return;
        }

        suggestedQuestionsContainer.innerHTML = '';

        const label = document.createElement('div');
        label.id = 'suggested-questions-label';
        label.textContent = 'Suggested Questions';
        suggestedQuestionsContainer.appendChild(label);

        questions.forEach(question => {
            const button = document.createElement('button');
            button.className = 'suggested-question-btn';
            button.textContent = question;
            button.type = 'button';
            button.addEventListener('click', () => {
                messageInput.value = question;
                messageInput.focus();
                // Optionally auto-submit
                // inputForm.dispatchEvent(new Event('submit'));
            });
            suggestedQuestionsContainer.appendChild(button);
        });

        suggestedQuestionsContainer.style.display = 'flex';
    }

    async function updateSuggestedQuestions() {
        // Immediately hide any stale questions
        suggestedQuestionsContainer.style.display = 'none';

        if (!activeCamp) {
            return;
        }

        // Cancel any previous in-flight request
        if (currentQuestionsFetchController) {
            currentQuestionsFetchController.abort();
        }

        // Create new controller for this request
        currentQuestionsFetchController = new AbortController();

        const camperContext = buildEnhancedCamperContext();
        const questions = await fetchSuggestedQuestions(activeCamp.vectorStoreId, camperContext, currentQuestionsFetchController.signal);
        renderSuggestedQuestions(questions);
    }

    const thinkingPhrases = [
        'Pondering deeply...', 'Consulting archives...', 'Diving in...',
        'Retrieving wisdom...', 'Thinking thoughts...', 'Scanning memory...',
        'Processing vibes...', 'Brain crunching...', 'Summoning knowledge...',
        'Connecting dots...', 'Mining data...', 'Cooking up answer...',
        'Searching scrolls...', 'Computing magic...', 'Assembling thoughts...',
        'Fetching intel...', 'Reading libraries...', 'Brewing response...',
        'Gathering context...', 'Synthesizing ideas...'
    ];

    function populateCampSelector(camps: Camp[]) {
        campSelector.innerHTML = '';

        if (camps.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No camps available';
            campSelector.appendChild(option);
            return;
        }

        // Add default "select a camp" option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select a camp...';
        campSelector.appendChild(defaultOption);

        camps.forEach(camp => {
            const option = document.createElement('option');
            option.value = camp.vectorStoreId;
            option.textContent = camp.name;
            campSelector.appendChild(option);
        });
    }

    function addCamperCard() {
        const camperId = generateCamperId();
        const newCamper: CamperProfile = {
            id: camperId,
            name: '',
            segments: {}
        };
        campers.push(newCamper);
        renderCamperCards();
    }

    function removeCamperCard(camperId: string) {
        if (campers.length <= 1) return; // Always keep at least one camper

        campers = campers.filter(c => c.id !== camperId);
        renderCamperCards();
        updateWelcomeMessage();
    }

    function renderCamperCards() {
        campersContainer.innerHTML = '';

        campers.forEach(camper => {
            const card = document.createElement('div');
            card.dataset.camperId = camper.id;
            card.style.padding = '1rem';
            card.style.border = '1px solid var(--border-color)';
            card.style.borderRadius = '8px';
            card.style.backgroundColor = 'var(--card-bg)';
            card.style.position = 'relative';

            const grid = document.createElement('div');
            grid.style.display = 'grid';
            grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(180px, 1fr))';
            grid.style.gap = '1rem';
            grid.style.alignItems = 'end';
            if (campers.length > 1) {
                grid.style.paddingRight = '3rem'; // Make room for remove button
            }

            // Camper name selector
            const nameWrapper = document.createElement('div');
            const nameLabel = document.createElement('label');
            nameLabel.textContent = 'Camper Name:';
            nameLabel.style.display = 'block';
            nameLabel.style.marginBottom = '0.5rem';
            nameLabel.style.fontWeight = '500';
            nameLabel.style.color = 'var(--text-primary)';
            nameLabel.style.fontSize = '0.9rem';

            const nameSelect = document.createElement('select');
            nameSelect.dataset.camperId = camper.id;
            nameSelect.dataset.field = 'name';
            nameSelect.style.width = '100%';
            nameSelect.style.padding = '0.65rem 0.85rem';
            nameSelect.style.borderRadius = '8px';
            nameSelect.style.backgroundColor = 'var(--input-bg)';
            nameSelect.style.color = 'var(--text-primary)';
            nameSelect.style.border = '1px solid var(--border-color)';
            nameSelect.style.fontSize = '0.95rem';
            nameSelect.style.cursor = 'pointer';
            nameSelect.style.outline = 'none';

            const defaultNameOption = document.createElement('option');
            defaultNameOption.value = '';
            defaultNameOption.textContent = 'Select camper...';
            nameSelect.appendChild(defaultNameOption);

            MOCK_CAMPER_NAMES.forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                if (camper.name === name) option.selected = true;
                nameSelect.appendChild(option);
            });

            nameSelect.addEventListener('change', (e) => {
                const target = e.target as HTMLSelectElement;
                const camperId = target.dataset.camperId!;
                const camperObj = campers.find(c => c.id === camperId);
                if (camperObj) {
                    camperObj.name = target.value;
                    camperObj.segments = {}; // Reset segments when name changes
                    updateWelcomeMessage();
                }
            });

            nameWrapper.appendChild(nameLabel);
            nameWrapper.appendChild(nameSelect);
            grid.appendChild(nameWrapper);

            // Segment selectors
            availableSegments.forEach(segment => {
                const segmentWrapper = document.createElement('div');
                const segmentLabel = document.createElement('label');
                segmentLabel.textContent = `${segment.label}:`;
                segmentLabel.style.display = 'block';
                segmentLabel.style.marginBottom = '0.5rem';
                segmentLabel.style.fontWeight = '500';
                segmentLabel.style.color = 'var(--text-primary)';
                segmentLabel.style.fontSize = '0.9rem';

                const segmentSelect = document.createElement('select');
                segmentSelect.dataset.camperId = camper.id;
                segmentSelect.dataset.segmentLabel = segment.label;
                segmentSelect.style.width = '100%';
                segmentSelect.style.padding = '0.65rem 0.85rem';
                segmentSelect.style.borderRadius = '8px';
                segmentSelect.style.backgroundColor = 'var(--input-bg)';
                segmentSelect.style.color = 'var(--text-primary)';
                segmentSelect.style.border = '1px solid var(--border-color)';
                segmentSelect.style.fontSize = '0.95rem';
                segmentSelect.style.cursor = 'pointer';
                segmentSelect.style.outline = 'none';

                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = `Select ${segment.label.toLowerCase()}...`;
                segmentSelect.appendChild(defaultOption);

                segment.values.forEach(value => {
                    const option = document.createElement('option');
                    option.value = value;
                    option.textContent = value;
                    if (camper.segments[segment.label] === value) option.selected = true;
                    segmentSelect.appendChild(option);
                });

                segmentSelect.addEventListener('change', (e) => {
                    const target = e.target as HTMLSelectElement;
                    const camperId = target.dataset.camperId!;
                    const segmentLabel = target.dataset.segmentLabel!;
                    const camperObj = campers.find(c => c.id === camperId);
                    if (camperObj) {
                        camperObj.segments[segmentLabel] = target.value;
                        updateWelcomeMessage();
                    }
                });

                segmentWrapper.appendChild(segmentLabel);
                segmentWrapper.appendChild(segmentSelect);
                grid.appendChild(segmentWrapper);
            });

            card.appendChild(grid);

            // Remove button (only show if more than 1 camper) - positioned absolutely
            if (campers.length > 1) {
                const removeButton = document.createElement('button');
                removeButton.type = 'button';
                removeButton.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
                removeButton.style.position = 'absolute';
                removeButton.style.top = '1rem';
                removeButton.style.right = '1rem';
                removeButton.style.padding = '0.5rem';
                removeButton.style.borderRadius = '6px';
                removeButton.style.backgroundColor = 'transparent';
                removeButton.style.color = 'var(--text-secondary)';
                removeButton.style.border = '1px solid var(--border-color)';
                removeButton.style.cursor = 'pointer';
                removeButton.style.transition = 'all 0.2s';
                removeButton.title = 'Remove camper';

                removeButton.addEventListener('click', () => removeCamperCard(camper.id));
                removeButton.addEventListener('mouseenter', () => {
                    removeButton.style.backgroundColor = 'var(--input-bg)';
                    removeButton.style.borderColor = '#ff4444';
                    removeButton.style.color = '#ff4444';
                });
                removeButton.addEventListener('mouseleave', () => {
                    removeButton.style.backgroundColor = 'transparent';
                    removeButton.style.borderColor = 'var(--border-color)';
                    removeButton.style.color = 'var(--text-secondary)';
                });

                card.appendChild(removeButton);
            }

            campersContainer.appendChild(card);
        });
    }

    function buildEnhancedCamperContext(): string {
        const configuredCampers = campers.filter(c => c.name);

        if (configuredCampers.length === 0) {
            return '';
        }

        const camperDescriptions = configuredCampers.map(camper => {
            const firstName = extractFirstName(camper.name);
            const segmentDetails = Object.entries(camper.segments)
                .filter(([_, value]) => value)
                .map(([label, value]) => `${label}: ${value}`)
                .join(', ');

            if (segmentDetails) {
                return `${firstName} (${segmentDetails})`;
            } else {
                return firstName;
            }
        });

        const count = configuredCampers.length;
        const camperList = camperDescriptions.join(', ');

        return `You are assisting a parent who has ${count} camper${count > 1 ? 's' : ''} enrolled: ${camperList}. When answering questions, use first names naturally (${configuredCampers.map(c => extractFirstName(c.name)).join(', ')}) and tailor your responses to their specific sessions and age groups. Search the documentation for information that is relevant to their particular enrollment details.`;
    }

    function buildDynamicWelcomeMessage(): string {
        const configuredCampers = campers.filter(c => c.name);

        if (configuredCampers.length === 0) {
            return "Hi! I can help answer questions about your selected camp. What would you like to know?";
        }

        const firstNames = configuredCampers.map(c => extractFirstName(c.name));
        const namesList = firstNames.length === 1
            ? firstNames[0]
            : firstNames.slice(0, -1).join(', ') + ' and ' + firstNames[firstNames.length - 1];

        return `Hi! I see you have ${namesList} registered. I can help answer questions specific to ${firstNames.length === 1 ? 'their' : 'their'} camp experience. What would you like to know?`;
    }

    function updateWelcomeMessage() {
        const welcomeMsg = buildDynamicWelcomeMessage();
        const botMessages = chatContainer.querySelectorAll('.bot-message');
        if (botMessages.length > 0) {
            const firstBotMessage = botMessages[0];
            firstBotMessage.textContent = welcomeMsg;
        }
        // Update suggested questions when camper details change
        updateSuggestedQuestions();
    }

    async function* queryStream(userMessage: string, vectorStoreId: string, instructions: string): AsyncGenerator<{ text?: string; citations?: FileSearchResult[] }, void, unknown> {
        try {
            const camperContext = buildEnhancedCamperContext();

            // Load custom instructions for this camp
            const customInstructions = await loadCustomInstructions(vectorStoreId);

            const response = await fetch(CHAT_API_ENDPOINT, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    message: userMessage,
                    vectorStoreId: vectorStoreId,
                    instructions: instructions,
                    camperContext: camperContext,
                    customInstructions: customInstructions,
                    conversationHistory: conversationHistory.slice(-10) // Last 5 exchanges
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API error: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error("Response body is not readable");
            }

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;

                        try {
                            const parsed = JSON.parse(data);
                            console.log('Streaming event:', parsed.type, parsed);

                            // Handle different event types for streaming
                            if (parsed.type === 'response.output_item.delta') {
                                // Extract text delta from the streaming response
                                const delta = parsed.delta;
                                if (delta?.content) {
                                    for (const contentItem of delta.content) {
                                        if (contentItem.type === 'output_text' && contentItem.text) {
                                            yield { text: contentItem.text };
                                        }
                                    }
                                }
                            }
                            // Also try handling response.output_text.delta event type
                            else if (parsed.type === 'response.output_text.delta' && parsed.delta) {
                                yield { text: parsed.delta };
                            }
                            // Handle content_block.delta event type (alternative format)
                            else if (parsed.type === 'content_block.delta' && parsed.delta?.text) {
                                yield { text: parsed.delta.text };
                            }
                            // Handle file search results from response.output_item.done event
                            else if (parsed.type === 'response.output_item.done') {
                                if (parsed.item?.type === 'file_search_call' && parsed.item?.results) {
                                    yield { citations: parsed.item.results };
                                }
                            }
                        } catch (e) {
                            console.warn('Failed to parse SSE data:', data);
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Failed to query API:", error);
            yield { text: "Sorry, I encountered an error connecting to the service. Please check the console for details." };
        }
    }
    
    const processInlineMarkdown = (parent: HTMLElement, text: string) => {
        const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
        parts.forEach(part => {
            if (!part) return;
            if (part.startsWith('**') && part.endsWith('**')) {
                const strong = document.createElement('strong');
                strong.textContent = part.substring(2, part.length - 2);
                parent.appendChild(strong);
            } else if (part.startsWith('*') && part.endsWith('*')) {
                const em = document.createElement('em');
                em.textContent = part.substring(1, part.length - 1);
                parent.appendChild(em);
            } else {
                parent.appendChild(document.createTextNode(part));
            }
        });
    };

    const applyMarkdown = (element: HTMLElement, text: string) => {
        element.innerHTML = '';
        
        const lines = text.split('\n');
        let currentList: HTMLUListElement | null = null;
        let paragraphBuffer: string[] = [];
    
        const flushParagraph = () => {
            if (paragraphBuffer.length > 0) {
                const p = document.createElement('p');
                processInlineMarkdown(p, paragraphBuffer.join(' ').trim());
                element.appendChild(p);
                paragraphBuffer = [];
            }
        };
    
        lines.forEach(line => {
            const trimmedLine = line.trim();
    
            if (trimmedLine.startsWith('### ')) {
                flushParagraph();
                currentList = null;
                const h3 = document.createElement('h3');
                processInlineMarkdown(h3, trimmedLine.substring(4));
                element.appendChild(h3);
            } else if (trimmedLine.startsWith('* ') || trimmedLine.startsWith('- ')) {
                flushParagraph();
                if (!currentList) {
                    currentList = document.createElement('ul');
                    element.appendChild(currentList);
                }
                const li = document.createElement('li');
                processInlineMarkdown(li, trimmedLine.substring(2));
                currentList.appendChild(li);
            } else if (trimmedLine === '') {
                flushParagraph();
                currentList = null;
            } else if (trimmedLine) {
                // If we were in a list, a non-list-item line ends the list.
                currentList = null;
                paragraphBuffer.push(trimmedLine);
            }
        });
    
        flushParagraph();
    };

    const addMessage = (sender: 'user' | 'bot', text: string, isThinking: boolean = false) => {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', `${sender}-message`);

        if (isThinking) {
            messageElement.classList.add('thinking');
            messageElement.id = 'thinking-message';
        } else {
            if (sender === 'user') {
                messageElement.textContent = text;
            } else {
                 applyMarkdown(messageElement, text);
            }
        }

        chatContainer.appendChild(messageElement);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        return messageElement;
    };

    const renderCitations = (citations: FileSearchResult[]) => {
        citationsContainer.innerHTML = '';

        if (!citations || citations.length === 0) {
            citationsContainer.style.display = 'none';
            return;
        }

        // Create header with toggle button
        const header = document.createElement('div');
        header.className = 'citations-header';

        const headerLeft = document.createElement('div');
        headerLeft.className = 'citations-header-left';

        const heading = document.createElement('h2');
        heading.textContent = 'Sources';
        headerLeft.appendChild(heading);

        const count = document.createElement('span');
        count.className = 'citations-count';
        count.textContent = `${citations.length}`;
        headerLeft.appendChild(count);

        header.appendChild(headerLeft);

        // Create chevron icon
        const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        chevron.setAttribute('class', 'citations-toggle-icon');
        chevron.setAttribute('width', '20');
        chevron.setAttribute('height', '20');
        chevron.setAttribute('viewBox', '0 0 24 24');
        chevron.setAttribute('fill', 'none');
        chevron.setAttribute('stroke', 'currentColor');
        chevron.setAttribute('stroke-width', '2');
        chevron.setAttribute('stroke-linecap', 'round');
        chevron.setAttribute('stroke-linejoin', 'round');

        const chevronPath = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        chevronPath.setAttribute('points', '6 9 12 15 18 9');
        chevron.appendChild(chevronPath);

        header.appendChild(chevron);

        citationsContainer.appendChild(header);

        // Create collapsible content container
        const content = document.createElement('div');
        content.className = 'citations-content';

        const description = document.createElement('p');
        description.className = 'citations-description';
        description.textContent = 'The following sources were used to answer your question:';
        content.appendChild(description);

        const grid = document.createElement('div');
        grid.className = 'citations-grid';

        citations.forEach((citation, index) => {
            const card = document.createElement('div');
            card.className = 'citation-card';

            const title = document.createElement('div');
            title.className = 'citation-card-title';

            const number = document.createElement('span');
            number.className = 'citation-number';
            number.textContent = `${index + 1}`;
            title.appendChild(number);

            const filename = document.createElement('span');
            filename.textContent = citation.filename;
            title.appendChild(filename);

            card.appendChild(title);

            if (citation.text) {
                const contentDiv = document.createElement('div');
                contentDiv.className = 'citation-card-content';
                contentDiv.textContent = citation.text;
                card.appendChild(contentDiv);
            }

            if (citation.score !== undefined) {
                const score = document.createElement('div');
                score.className = 'citation-card-score';
                score.textContent = `Relevance: ${(citation.score * 100).toFixed(1)}%`;
                card.appendChild(score);
            }

            grid.appendChild(card);
        });

        content.appendChild(grid);
        citationsContainer.appendChild(content);

        // Add click handler to toggle
        header.addEventListener('click', () => {
            const isExpanded = content.classList.contains('expanded');
            if (isExpanded) {
                content.classList.remove('expanded');
                chevron.classList.remove('expanded');
            } else {
                content.classList.add('expanded');
                chevron.classList.add('expanded');
            }
        });

        citationsContainer.style.display = 'flex';
    };

    const handleFormSubmit = async (event: Event) => {
        event.preventDefault();
        const userMessage = messageInput.value.trim();

        if (!userMessage) {
            return;
        }

        // Check if still initializing
        if (isInitializing) {
            return;
        }

        messageInput.disabled = true;
        sendButton.disabled = true;

        addMessage('user', userMessage);
        messageInput.value = '';

        // Hide suggested questions after first message
        hasUserSentMessage = true;
        suggestedQuestionsContainer.style.display = 'none';

        if (thinkingInterval) clearInterval(thinkingInterval);

        const thinkingMessage = addMessage('bot', '', true);

        const setWavyText = (element: HTMLElement, text: string) => {
            element.innerHTML = '';
            text.split('').forEach((char, index) => {
                const span = document.createElement('span');
                if (char === ' ') {
                    span.innerHTML = '&nbsp;';
                } else {
                    span.textContent = char;
                }
                span.style.animationDelay = `${index * 50}ms`;
                element.appendChild(span);
            });
        };

        const updateThinkingMessage = () => {
            const randomIndex = Math.floor(Math.random() * thinkingPhrases.length);
            setWavyText(thinkingMessage, thinkingPhrases[randomIndex]);
        };

        updateThinkingMessage();
        thinkingInterval = window.setInterval(updateThinkingMessage, 3000);

        if (!activeCamp) {
            addMessage('bot', 'Please select a camp from the dropdown in the registration area first.');
            messageInput.disabled = false;
            sendButton.disabled = false;
            return;
        }

        // Transform the query for better vector search
        let searchQuery = userMessage;
        try {
            const transformResponse = await fetch(TRANSFORM_QUERY_API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: userMessage,
                    conversationHistory: conversationHistory.slice(-6) // Last 3 exchanges
                })
            });

            if (transformResponse.ok) {
                const transformData = await transformResponse.json();
                searchQuery = transformData.transformedQuery;
                console.log('Query transformed:', userMessage, '→', searchQuery);
            }
        } catch (error) {
            console.warn('Query transformation failed, using original:', error);
            // Fall back to original question if transformation fails
        }

        const vectorStoreId = activeCamp.vectorStoreId;
        const instructions = INSTRUCTIONS;

        // Remove thinking message once streaming starts
        let streamingMessageElement: HTMLElement | null = null;
        let fullResponseText = '';
        let citations: FileSearchResult[] = [];

        try {
            const stream = queryStream(searchQuery, vectorStoreId, instructions);

            for await (const chunk of stream) {
                // Handle text chunks
                if (chunk.text) {
                    // Remove thinking message on first chunk
                    if (thinkingInterval) {
                        clearInterval(thinkingInterval);
                        thinkingInterval = null;
                        thinkingMessage.remove();
                    }

                    // Create message element on first chunk
                    if (!streamingMessageElement) {
                        streamingMessageElement = addMessage('bot', '');
                    }

                    // Append the chunk to our full response
                    fullResponseText += chunk.text;

                    // Update the message element with markdown rendering
                    applyMarkdown(streamingMessageElement, fullResponseText);

                    // Scroll to bottom after DOM updates
                    requestAnimationFrame(() => {
                        chatContainer.scrollTop = chatContainer.scrollHeight;
                    });
                }

                // Handle citations
                if (chunk.citations) {
                    citations = chunk.citations;
                }
            }

            // Render citations after streaming is complete
            if (citations.length > 0) {
                renderCitations(citations);
                // Scroll to show citations after they're rendered
                requestAnimationFrame(() => {
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                });
            }

            // Add to conversation history after successful response
            conversationHistory.push(`User: ${userMessage}`);
            conversationHistory.push(`Assistant: ${fullResponseText}`);

        } catch (error) {
            console.error('Streaming error:', error);
            if (thinkingInterval) {
                clearInterval(thinkingInterval);
                thinkingInterval = null;
                thinkingMessage.remove();
            }
            if (!streamingMessageElement) {
                addMessage('bot', 'Sorry, I encountered an error. Please try again.');
            }
        }

        messageInput.disabled = false;
        sendButton.disabled = false;
        messageInput.focus();
    };
    
    const toggleWidget = () => {
        widgetContainer.classList.toggle('open');
        if (widgetContainer.classList.contains('open')) {
            messageInput.focus();
        }
    }

    const toggleFullScreen = () => {
        widgetContainer.classList.toggle('fullscreen');
    }

    const resetConversation = () => {
        chatContainer.innerHTML = '';
        citationsContainer.style.display = 'none';
        citationsContainer.innerHTML = '';
        conversationHistory = []; // Clear conversation history
        const welcomeMsg = buildDynamicWelcomeMessage();
        addMessage('bot', welcomeMsg);

        // Reset flag and show suggested questions again
        hasUserSentMessage = false;
        updateSuggestedQuestions();
    }

    const switchCamp = async (camp: Camp) => {
        // Disable launcher and form during camp switch
        launcher.disabled = true;
        launcher.classList.add('loading');
        messageInput.disabled = true;
        sendButton.disabled = true;

        activeCamp = camp;
        headerTitle.textContent = `${camp.name} Parent Handbook`;
        headerSubtitle.textContent = `Ask questions that can be answered by the ${camp.name} parent handbook.`;

        chatContainer.innerHTML = '';
        citationsContainer.style.display = 'none';
        citationsContainer.innerHTML = '';
        conversationHistory = []; // Clear conversation history when switching camps
        const welcomeMsg = buildDynamicWelcomeMessage();
        addMessage('bot', welcomeMsg);

        // Reset flag when switching camps
        hasUserSentMessage = false;

        // Show custom instructions section
        customInstructionsSection.style.display = 'block';

        // Show personalization section
        personalizationSection.style.display = 'block';

        // Reset campers array
        campers = [];
        campersContainer.innerHTML = '';

        // Show loading indicator
        segmentsLoading.style.display = 'block';
        addCamperButton.style.display = 'none';

        // Fetch segments for this camp (will be instant for Camp Colorado)
        availableSegments = await fetchSegments(camp.vectorStoreId);

        // Hide loading indicator and show add button
        segmentsLoading.style.display = 'none';
        addCamperButton.style.display = 'flex';

        // Pre-load custom instructions in background (non-blocking)
        loadCustomInstructions(camp.vectorStoreId);

        // Add first camper card
        addCamperCard();

        // Load initial suggested questions (without camper context)
        updateSuggestedQuestions();

        // Re-enable launcher and form after camp switch completes
        launcher.disabled = false;
        launcher.classList.remove('loading');
        messageInput.disabled = false;
        sendButton.disabled = false;
        messageInput.focus();
    };

    // Initialize the app
    async function initialize() {
        // Disable launcher and show loading state
        launcher.disabled = true;
        launcher.classList.add('loading');
        messageInput.disabled = true;
        sendButton.disabled = true;

        availableCamps = await fetchVectorStores();
        populateCampSelector(availableCamps);

        // Auto-select first camp if available
        if (availableCamps.length > 0) {
            campSelector.value = availableCamps[0].vectorStoreId;
            // Await switchCamp to complete before re-enabling
            await switchCamp(availableCamps[0]);
        }

        // Initialization complete
        isInitializing = false;

        // Re-enable launcher and form after initialization
        launcher.disabled = false;
        launcher.classList.remove('loading');
        messageInput.disabled = false;
        sendButton.disabled = false;
    }

    campSelector.addEventListener('change', async () => {
        const selectedVectorStoreId = campSelector.value;

        if (!selectedVectorStoreId) {
            activeCamp = null;
            headerTitle.textContent = 'Parent Handbook';
            headerSubtitle.textContent = 'Select a camp to get started';
            customInstructionsSection.style.display = 'none';
            personalizationSection.style.display = 'none';
            messageInput.disabled = true;
            sendButton.disabled = true;
            return;
        }

        const selectedCamp = availableCamps.find(camp => camp.vectorStoreId === selectedVectorStoreId);
        if (selectedCamp) {
            await switchCamp(selectedCamp);
        }
    });

    addCamperButton.addEventListener('click', addCamperCard);
    customInstructionsToggle.addEventListener('click', toggleCustomInstructions);
    saveCustomInstructionsButton.addEventListener('click', saveCustomInstructions);
    deleteCustomInstructionsButton.addEventListener('click', deleteCustomInstructions);
    loadTemplateButton.addEventListener('click', loadInstructionsTemplate);

    inputForm.addEventListener('submit', handleFormSubmit);
    launcher.addEventListener('click', toggleWidget);
    expandButton.addEventListener('click', toggleFullScreen);
    resetButton.addEventListener('click', resetConversation);

    // Initialize the app
    initialize();
});
