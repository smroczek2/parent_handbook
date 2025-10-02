
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
    name: string;
    segments: { [key: string]: string };
}

document.addEventListener('DOMContentLoaded', () => {
    const chatContainer = document.getElementById('chat-container') as HTMLDivElement;
    const inputForm = document.getElementById('input-area') as HTMLFormElement;
    const messageInput = document.getElementById('message-input') as HTMLInputElement;
    const sendButton = document.getElementById('send-button') as HTMLButtonElement;
    const launcher = document.getElementById('chat-launcher') as HTMLButtonElement;
    const widgetContainer = document.getElementById('chat-widget-container') as HTMLDivElement;
    const expandButton = document.getElementById('expand-button') as HTMLButtonElement;
    const headerTitle = document.getElementById('header-title') as HTMLHeadingElement;
    const campSelector = document.getElementById('camp-selector') as HTMLSelectElement;
    const personalizationSection = document.getElementById('personalization-section') as HTMLDivElement;
    const camperSelector = document.getElementById('camper-selector') as HTMLSelectElement;
    const segmentDropdownsContainer = document.getElementById('segment-dropdowns-container') as HTMLDivElement;
    const segmentsLoading = document.getElementById('segments-loading') as HTMLDivElement;
    const segmentsContent = document.getElementById('segments-content') as HTMLDivElement;

    // Use Vercel serverless functions instead of direct OpenAI API calls
    const CHAT_API_ENDPOINT = "/api/chat";
    const VECTOR_STORES_API_ENDPOINT = "/api/vector-stores";
    const EXTRACT_SEGMENTS_API_ENDPOINT = "/api/extract-segments";

    const WELCOME_MESSAGE = "Hi! I can help answer questions about your selected camp. What would you like to know?";
    const INSTRUCTIONS = "You are a helpful AI assistant for a summer camp. Your role is to help parents find answers to their questions about the camp by searching through the camp's documentation. Be friendly, informative, and concise. Focus on providing accurate information from the documentation. If a question cannot be answered from the available documents, politely let the parent know. Respond only to the question asked and do not offer any follow up actions.";

    let availableCamps: Camp[] = [];
    let activeCamp: Camp | null = null;
    let thinkingInterval: number | null = null;
    let availableSegments: SegmentOption[] = [];
    let selectedCamper: CamperProfile = { name: '', segments: {} };

    // Mock camper names for proof of concept
    const MOCK_CAMPER_NAMES = ['Alex Thompson', 'Jordan Martinez', 'Taylor Kim', 'Casey Johnson'];

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

    function populateCamperSelector() {
        camperSelector.innerHTML = '';

        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select a camper...';
        camperSelector.appendChild(defaultOption);

        MOCK_CAMPER_NAMES.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            camperSelector.appendChild(option);
        });
    }

    function renderSegmentDropdowns(segments: SegmentOption[]) {
        segmentDropdownsContainer.innerHTML = '';

        segments.forEach(segment => {
            const wrapper = document.createElement('div');

            const label = document.createElement('label');
            label.textContent = `${segment.label}:`;
            label.style.display = 'block';
            label.style.marginBottom = '0.5rem';
            label.style.fontWeight = '500';
            label.style.color = 'var(--text-primary)';
            label.style.fontSize = '0.9rem';

            const select = document.createElement('select');
            select.dataset.segmentLabel = segment.label;
            select.style.width = '100%';
            select.style.padding = '0.65rem 0.85rem';
            select.style.borderRadius = '8px';
            select.style.backgroundColor = 'var(--input-bg)';
            select.style.color = 'var(--text-primary)';
            select.style.border = '1px solid var(--border-color)';
            select.style.fontSize = '0.95rem';
            select.style.cursor = 'pointer';
            select.style.outline = 'none';

            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = `Select ${segment.label.toLowerCase()}...`;
            select.appendChild(defaultOption);

            segment.values.forEach(value => {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = value;
                select.appendChild(option);
            });

            select.addEventListener('change', () => {
                if (select.dataset.segmentLabel) {
                    selectedCamper.segments[select.dataset.segmentLabel] = select.value;
                }
            });

            wrapper.appendChild(label);
            wrapper.appendChild(select);
            segmentDropdownsContainer.appendChild(wrapper);
        });
    }

    function buildCamperContext(): string {
        if (!selectedCamper.name) {
            return '';
        }

        const segmentDetails = Object.entries(selectedCamper.segments)
            .filter(([_, value]) => value)
            .map(([label, value]) => `${label}: ${value}`)
            .join(', ');

        if (segmentDetails) {
            return `Context: The parent is asking about ${selectedCamper.name}. Camper details: ${segmentDetails}.`;
        } else {
            return `Context: The parent is asking about ${selectedCamper.name}.`;
        }
    }

    async function* queryStream(userMessage: string, vectorStoreId: string, instructions: string): AsyncGenerator<string, void, unknown> {
        try {
            const camperContext = buildCamperContext();

            const response = await fetch(CHAT_API_ENDPOINT, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    message: userMessage,
                    vectorStoreId: vectorStoreId,
                    instructions: instructions,
                    camperContext: camperContext
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
                                            yield contentItem.text;
                                        }
                                    }
                                }
                            }
                            // Also try handling response.output_text.delta event type
                            else if (parsed.type === 'response.output_text.delta' && parsed.delta) {
                                yield parsed.delta;
                            }
                            // Handle content_block.delta event type (alternative format)
                            else if (parsed.type === 'content_block.delta' && parsed.delta?.text) {
                                yield parsed.delta.text;
                            }
                        } catch (e) {
                            console.warn('Failed to parse SSE data:', data);
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Failed to query API:", error);
            yield "Sorry, I encountered an error connecting to the service. Please check the console for details.";
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

    const handleFormSubmit = async (event: Event) => {
        event.preventDefault();
        const userMessage = messageInput.value.trim();

        if (!userMessage) {
            return;
        }

        messageInput.disabled = true;
        sendButton.disabled = true;
        
        addMessage('user', userMessage);
        messageInput.value = '';

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

        const vectorStoreId = activeCamp.vectorStoreId;
        const instructions = INSTRUCTIONS;

        // Remove thinking message once streaming starts
        let streamingMessageElement: HTMLElement | null = null;
        let fullResponseText = '';

        try {
            const stream = queryStream(userMessage, vectorStoreId, instructions);

            for await (const textChunk of stream) {
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
                fullResponseText += textChunk;

                // Update the message element with markdown rendering
                applyMarkdown(streamingMessageElement, fullResponseText);

                // Scroll to bottom
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
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

    const switchCamp = async (camp: Camp) => {
        activeCamp = camp;
        headerTitle.textContent = `${camp.name} AI`;

        chatContainer.innerHTML = '';
        addMessage('bot', WELCOME_MESSAGE);
        messageInput.focus();

        // Show personalization section
        personalizationSection.style.display = 'block';

        // Reset camper selection first
        selectedCamper = { name: '', segments: {} };
        camperSelector.value = '';

        // Clear existing segment dropdowns
        segmentDropdownsContainer.innerHTML = '';

        // Show loading indicator
        segmentsLoading.style.display = 'block';
        segmentsContent.style.display = 'none';

        // Fetch and render new segments for this camp
        availableSegments = await fetchSegments(camp.vectorStoreId);
        renderSegmentDropdowns(availableSegments);

        // Hide loading indicator and show content
        segmentsLoading.style.display = 'none';
        segmentsContent.style.display = 'grid';
    };

    // Initialize the app
    async function initialize() {
        availableCamps = await fetchVectorStores();
        populateCampSelector(availableCamps);
        populateCamperSelector();

        // Auto-select first camp if available
        if (availableCamps.length > 0) {
            activeCamp = availableCamps[0];
            campSelector.value = activeCamp.vectorStoreId;
            headerTitle.textContent = `${activeCamp.name} AI`;

            // Load segments for first camp
            personalizationSection.style.display = 'block';
            segmentsLoading.style.display = 'block';
            segmentsContent.style.display = 'none';

            availableSegments = await fetchSegments(activeCamp.vectorStoreId);
            renderSegmentDropdowns(availableSegments);

            segmentsLoading.style.display = 'none';
            segmentsContent.style.display = 'grid';
        }

        addMessage('bot', WELCOME_MESSAGE);
    }

    campSelector.addEventListener('change', () => {
        const selectedVectorStoreId = campSelector.value;

        if (!selectedVectorStoreId) {
            activeCamp = null;
            headerTitle.textContent = 'Camp AI Assistant';
            personalizationSection.style.display = 'none';
            return;
        }

        const selectedCamp = availableCamps.find(camp => camp.vectorStoreId === selectedVectorStoreId);
        if (selectedCamp) {
            switchCamp(selectedCamp);
        }
    });

    camperSelector.addEventListener('change', () => {
        selectedCamper.name = camperSelector.value;
        selectedCamper.segments = {};

        // Reset all segment dropdowns
        const segmentSelects = segmentDropdownsContainer.querySelectorAll('select');
        segmentSelects.forEach(select => {
            (select as HTMLSelectElement).value = '';
        });
    });

    inputForm.addEventListener('submit', handleFormSubmit);
    launcher.addEventListener('click', toggleWidget);
    expandButton.addEventListener('click', toggleFullScreen);

    // Initialize the app
    initialize();
});
