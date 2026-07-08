import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

// Configure transformers.js environment
env.allowLocalModels = false;
env.allowRemoteModels = true;
env.useBrowserCache = true;

class LLMPlayground {
    constructor() {
        this.generator = null;
        this.currentModel = null;
        this.isGenerating = false;
        this.chromeAISession = null;
        this.chromeAIAvailable = false;
        this.loadStartTime = null;
        this.loadEndTime = null;
        this.customModels = new Map();
        this.validationAbortController = null;

        this.initializeElements();
        this.attachEventListeners();
        this.checkChromeAI();
        this.setupCleanup();
    }

    setupCleanup() {
        // Clean up resources when page is closed/refreshed
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });

        // Clean up on visibility change (when tab is backgrounded for a while)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && !this.isGenerating) {
                // Optional: Could add aggressive cleanup here
                console.log('Tab backgrounded - models remain loaded');
            }
        });
    }

    async cleanup() {
        console.log('Cleaning up resources...');

        // Dispose transformers.js pipeline
        if (this.generator && typeof this.generator.dispose === 'function') {
            try {
                await this.generator.dispose();
                console.log('Pipeline disposed');
            } catch (error) {
                console.error('Error disposing pipeline:', error);
            }
        }

        // Destroy Chrome AI session
        if (this.chromeAISession && typeof this.chromeAISession.destroy === 'function') {
            try {
                this.chromeAISession.destroy();
                console.log('Chrome AI session destroyed');
            } catch (error) {
                console.error('Error destroying Chrome AI session:', error);
            }
        }

        this.generator = null;
        this.chromeAISession = null;
        this.currentModel = null;
    }

    initializeElements() {
        // Controls
        this.modelRadios = document.querySelectorAll('input[name="model"]');
        this.loadModelBtn = document.getElementById('load-model-btn');
        this.loadingStatus = document.getElementById('loading-status');
        this.loadingBar = document.getElementById('loading-bar');
        this.loadingText = document.getElementById('loading-text');

        // Custom model elements
        this.customModelUrl = document.getElementById('custom-model-url');
        this.validateBtn = document.getElementById('validate-custom-model');
        this.customModelFeedback = document.getElementById('custom-model-feedback');
        this.customModelCards = document.getElementById('custom-model-cards');

        // Generation
        this.generationSection = document.getElementById('generation-section');
        this.modelLoadedName = document.getElementById('model-loaded-name');
        this.promptInput = document.getElementById('prompt-input');
        this.generateBtn = document.getElementById('generate-btn');
        this.generationStatus = document.getElementById('generation-status');
        this.outputSection = document.getElementById('output-section');
        this.outputText = document.getElementById('output-text');
        this.metricsDisplay = document.getElementById('metrics-display');

        // Parameters
        this.maxTokensSlider = document.getElementById('max-tokens');
        this.maxTokensValue = document.getElementById('max-tokens-value');
        this.temperatureSlider = document.getElementById('temperature');
        this.temperatureValue = document.getElementById('temperature-value');
        this.topKSlider = document.getElementById('top-k');
        this.topKValue = document.getElementById('top-k-value');
        this.topPSlider = document.getElementById('top-p');
        this.topPValue = document.getElementById('top-p-value');
    }

    attachEventListeners() {
        // Model selection
        this.modelRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                this.loadModelBtn.disabled = !this.getSelectedModel();
            });
        });

        this.loadModelBtn.addEventListener('click', () => this.loadModel());

        // Custom model URL input - inline validation
        this.customModelUrl.addEventListener('input', (e) => {
            this.handleCustomModelInput(e.target.value);
        });

        // Validate button click
        this.validateBtn.addEventListener('click', () => {
            this.handleValidateCustomModel();
        });

        // Allow Enter key to trigger validation
        this.customModelUrl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !this.validateBtn.disabled) {
                this.handleValidateCustomModel();
            }
        });

        // Generation
        this.generateBtn.addEventListener('click', () => this.generateText());

        // Parameter sliders
        this.maxTokensSlider.addEventListener('input', (e) => {
            this.maxTokensValue.textContent = e.target.value;
        });

        this.temperatureSlider.addEventListener('input', (e) => {
            this.temperatureValue.textContent = parseFloat(e.target.value).toFixed(1);
        });

        this.topKSlider.addEventListener('input', (e) => {
            this.topKValue.textContent = e.target.value;
        });

        this.topPSlider.addEventListener('input', (e) => {
            this.topPValue.textContent = parseFloat(e.target.value).toFixed(2);
        });
    }

    getSelectedModel() {
        const selected = Array.from(this.modelRadios).find(radio => radio.checked);
        return selected ? selected.value : null;
    }

    async checkChromeAI() {
        const badge = document.getElementById('chrome-ai-badge');
        const card = document.getElementById('chrome-ai-card');
        const radio = document.getElementById('chrome-ai-radio');

        try {
            // Check if LanguageModel is available (official API as of Chrome 143+)
            if (typeof LanguageModel === 'undefined') {
                console.warn('Chrome AI LanguageModel API not found. Please check:');
                console.warn('1. Chrome version 127+ (Canary, Dev, or Beta recommended)');
                console.warn('2. Enable chrome://flags/#optimization-guide-on-device-model');
                console.warn('3. Enable chrome://flags/#prompt-api-for-gemini-nano');
                console.warn('4. Restart Chrome completely');
                console.warn('5. Visit chrome://components and click "Check for update" on "Optimization Guide On Device Model"');
                console.warn('6. Wait for model download (~1.7GB), then reload this page');
                console.warn('\nQuick test: Run this in console: typeof LanguageModel');
                throw new Error('LanguageModel API not available - check console for setup instructions');
            }

            // Check availability using the official API
            const availability = await LanguageModel.availability();
            console.log('Chrome AI availability:', availability);

            // Handle both string return ("readily"/"available") and object return ({available: "readily"})
            const availableStatus = typeof availability === 'string' ? availability : availability.available;
            console.log('Chrome AI status:', availableStatus);

            if (availableStatus === 'readily' || availableStatus === 'available') {
                this.chromeAIAvailable = true;
                badge.textContent = 'Available';
                badge.className = 'badge available';
                // Enable the radio button and card
                card.classList.remove('disabled');
                radio.disabled = false;
                card.title = 'Chrome Built-in AI (Gemini Nano) - Ready to use';
                console.log('✅ Chrome AI is ready to use!');
            } else if (availableStatus === 'after-download') {
                this.chromeAIAvailable = true;
                badge.textContent = 'Download Required';
                badge.className = 'badge checking';
                // Enable the radio button and card
                card.classList.remove('disabled');
                radio.disabled = false;
                card.title = 'Chrome AI available - model download required from chrome://components';
                console.log('⚠️ Chrome AI API found but model needs to be downloaded from chrome://components');
            } else {
                console.warn('Chrome AI status:', availableStatus);
                throw new Error(`Not available: ${availableStatus}`);
            }
        } catch (error) {
            console.error('Chrome AI not available:', error);
            console.log('📚 For setup instructions, visit: https://developer.chrome.com/docs/ai/get-started');
            this.chromeAIAvailable = false;
            badge.textContent = 'Unavailable';
            badge.className = 'badge unavailable';
            card.classList.add('disabled');
            radio.disabled = true;

            // Add setup instructions directly in the card
            const modelInfo = card.querySelector('.model-info');
            const existingSetup = card.querySelector('.chrome-ai-setup');
            if (!existingSetup) {
                const setupDiv = document.createElement('div');
                setupDiv.className = 'chrome-ai-setup';
                setupDiv.innerHTML = `
                    <div class="setup-links">
                        <strong>Enable Chrome AI:</strong><br>
                        1. <a href="chrome://flags/#optimization-guide-on-device-model" target="_blank">Enable optimization guide</a><br>
                        2. <a href="chrome://flags/#prompt-api-for-gemini-nano" target="_blank">Enable Prompt API</a><br>
                        3. Restart Chrome, then <a href="chrome://components" target="_blank">download model</a><br>
                        4. Test in console: <code>typeof LanguageModel</code>
                    </div>
                `;
                modelInfo.appendChild(setupDiv);
            }

            card.title = `Chrome AI unavailable. Click the links in the card to enable.`;
        }
    }

    async loadModel() {
        const modelName = this.getSelectedModel();
        if (!modelName) return;

        try {
            this.loadModelBtn.disabled = true;
            this.loadingStatus.classList.remove('hidden');
            this.loadingBar.style.width = '0%';
            this.loadingText.textContent = 'Cleaning up previous model...';

            // Clean up old model before loading new one
            await this.cleanup();

            this.loadingText.textContent = 'Initializing...';
            this.loadStartTime = performance.now();

            // Handle Chrome AI separately
            if (modelName === 'chrome-ai') {
                await this.loadChromeAI();
                return;
            }

            // Track progress across multiple files
            const fileProgress = {};
            let totalFiles = 0;

            // Determine task type based on model
            const taskType = modelName.includes('instruct') ? 'text-generation' : 'text-generation';

            // Load model with progress callback
            this.generator = await pipeline(taskType, modelName, {
                progress_callback: (progress) => {
                    console.log('Progress:', progress); // Debug logging

                    if (progress.status === 'progress' && progress.progress !== undefined) {
                        // Some models report progress directly
                        const percent = Math.round(progress.progress);
                        this.loadingBar.style.width = `${percent}%`;
                        this.loadingText.textContent = `Downloading ${progress.file || 'model'}... ${percent}%`;
                    } else if (progress.status === 'download') {
                        // Track individual file progress
                        const fileName = progress.file || 'unknown';
                        if (!fileProgress[fileName]) {
                            totalFiles++;
                        }
                        fileProgress[fileName] = {
                            loaded: progress.loaded || 0,
                            total: progress.total || 1
                        };

                        // Calculate overall progress
                        let totalLoaded = 0;
                        let totalSize = 0;
                        for (const file in fileProgress) {
                            totalLoaded += fileProgress[file].loaded;
                            totalSize += fileProgress[file].total;
                        }

                        const percent = totalSize > 0 ? Math.round((totalLoaded / totalSize) * 100) : 0;
                        this.loadingBar.style.width = `${percent}%`;
                        this.loadingText.textContent = `Downloading ${fileName}... ${percent}% (${totalFiles} files)`;
                    } else if (progress.status === 'done') {
                        this.loadingBar.style.width = '100%';
                        this.loadingText.textContent = `Download complete, loading model...`;
                    } else if (progress.status === 'ready') {
                        this.loadingText.textContent = 'Model loaded successfully!';
                    }
                }
            });

            this.currentModel = modelName;
            this.loadEndTime = performance.now();
            const loadTime = ((this.loadEndTime - this.loadStartTime) / 1000).toFixed(2);
            console.log(`Model loaded in ${loadTime} seconds`);

            // Get model display name
            const modelDisplayName = modelName.split('/').pop();

            // Hide loading status and show generation section
            setTimeout(() => {
                this.loadingStatus.classList.add('hidden');
                this.generationSection.classList.remove('hidden');
                this.loadModelBtn.disabled = false;

                // Show load time and model info
                this.loadingText.textContent = `Model loaded in ${loadTime}s`;
                this.modelLoadedName.textContent = `${modelDisplayName} (loaded in ${loadTime}s)`;
            }, 1000);

        } catch (error) {
            console.error('Error loading model:', error);
            this.loadingText.textContent = `Error loading model: ${error.message}`;
            this.loadModelBtn.disabled = false;
        }
    }

    async loadChromeAI() {
        try {
            this.loadingBar.style.width = '50%';
            this.loadingText.textContent = 'Creating Chrome AI session...';

            const temperature = parseFloat(this.temperatureSlider.value);
            const topK = parseInt(this.topKSlider.value);

            // Use the official LanguageModel.create() API
            const params = {
                monitor(m) {
                    m.addEventListener('downloadprogress', event => {
                        console.log(`Downloaded: ${event.loaded} of ${event.total} bytes.`);
                    });
                },
                temperature: temperature,
                topK: topK > 0 ? topK : 8
            };

            this.chromeAISession = await LanguageModel.create(params);

            this.currentModel = 'chrome-ai';
            this.loadEndTime = performance.now();
            const loadTime = ((this.loadEndTime - this.loadStartTime) / 1000).toFixed(2);
            console.log(`Chrome AI loaded in ${loadTime} seconds`);

            this.loadingBar.style.width = '100%';
            this.loadingText.textContent = `Chrome AI ready! (${loadTime}s)`;

            setTimeout(() => {
                this.loadingStatus.classList.add('hidden');
                this.generationSection.classList.remove('hidden');
                this.loadModelBtn.disabled = false;
                this.modelLoadedName.textContent = `Chrome Built-in AI (Gemini Nano) (loaded in ${loadTime}s)`;
            }, 500);

        } catch (error) {
            console.error('Error loading Chrome AI:', error);
            this.loadingText.textContent = `Error: ${error.message}`;
            this.loadModelBtn.disabled = false;
        }
    }

    countTokens(text) {
        // Simple token counting approximation
        // Real tokenization is model-specific, but this gives a reasonable estimate
        return text.match(/\w+|[^\s\w]/g)?.length || 0;
    }

    async generateText() {
        if ((!this.generator && !this.chromeAISession) || this.isGenerating) return;

        const prompt = this.promptInput.value.trim();
        if (!prompt) {
            alert('Please enter a prompt');
            return;
        }

        try {
            this.isGenerating = true;
            this.generateBtn.disabled = true;
            this.generationStatus.classList.remove('hidden');
            this.outputSection.classList.add('hidden');

            const startTime = performance.now();
            let generatedText;

            // Handle Chrome AI
            if (this.currentModel === 'chrome-ai') {
                generatedText = await this.chromeAISession.prompt(prompt);
            } else {
                // Handle Transformers.js models
                const maxNewTokens = parseInt(this.maxTokensSlider.value);
                const temperature = parseFloat(this.temperatureSlider.value);
                const topK = parseInt(this.topKSlider.value);
                const topP = parseFloat(this.topPSlider.value);

                const result = await this.generator(prompt, {
                    max_new_tokens: maxNewTokens,
                    temperature: temperature,
                    do_sample: temperature > 0,
                    top_k: topK > 0 ? topK : undefined,
                    top_p: topP,
                    repetition_penalty: 1.1,
                });

                generatedText = result[0].generated_text;
            }

            const endTime = performance.now();
            const generationTime = ((endTime - startTime) / 1000).toFixed(2);

            // Count tokens in the generated portion (excluding the prompt)
            const generatedPortion = generatedText.startsWith(prompt)
                ? generatedText.slice(prompt.length)
                : generatedText;
            const tokenCount = this.countTokens(generatedPortion);
            const tokensPerSecond = (tokenCount / parseFloat(generationTime)).toFixed(2);

            // Display result
            this.outputText.textContent = generatedText;
            this.outputSection.classList.remove('hidden');

            // Display metrics
            this.metricsDisplay.innerHTML = `
                <strong>Generation metrics:</strong>
                ${generationTime}s |
                ${tokenCount} tokens |
                ${tokensPerSecond} tokens/sec
            `;
            this.metricsDisplay.classList.remove('hidden');

            console.log(`Generated ${tokenCount} tokens in ${generationTime}s (${tokensPerSecond} tokens/sec)`);

        } catch (error) {
            console.error('Error generating text:', error);
            this.outputText.textContent = `Error generating text: ${error.message}`;
            this.outputSection.classList.remove('hidden');
        } finally {
            this.isGenerating = false;
            this.generateBtn.disabled = false;
            this.generationStatus.classList.add('hidden');
        }
    }

    parseHuggingFaceUrl(url) {
        const trimmed = url.trim();

        // Accept both full URLs and direct model IDs
        const urlPattern = /^https:\/\/huggingface\.co\/([^\/]+\/[^\/]+)\/?$/;
        const modelIdPattern = /^[^\/\s]+\/[^\/\s]+$/;

        const urlMatch = trimmed.match(urlPattern);
        if (urlMatch) {
            return { isValid: true, modelId: urlMatch[1], error: null };
        }

        const modelIdMatch = trimmed.match(modelIdPattern);
        if (modelIdMatch) {
            return { isValid: true, modelId: trimmed, error: null };
        }

        return {
            isValid: false,
            modelId: null,
            error: 'Invalid format. Use: https://huggingface.co/org/model or org/model'
        };
    }

    async validateModel(modelId) {
        // Cancel any previous validation
        if (this.validationAbortController) {
            this.validationAbortController.abort();
        }
        this.validationAbortController = new AbortController();

        try {
            const response = await fetch(
                `https://huggingface.co/api/models/${modelId}`,
                { signal: this.validationAbortController.signal }
            );

            if (response.status === 404) {
                return { success: false, error: 'Model not found. Check the URL and try again.' };
            }

            if (response.status === 403) {
                return { success: false, error: 'Access denied. This model may be private or gated.' };
            }

            if (!response.ok) {
                return { success: false, error: `Server error (${response.status}). Try again later.` };
            }

            const data = await response.json();

            // Check for gated models
            if (data.gated) {
                return {
                    success: false,
                    error: 'This is a gated model requiring approval. Cannot be loaded in browser.'
                };
            }

            // Only accept models specifically exported for transformers.js
            // Generic ONNX exports (like model.onnx) won't work - transformers.js
            // requires specific file patterns (decoder_model_merged.onnx, etc.)
            if (data.library_name !== 'transformers.js') {
                return {
                    success: false,
                    error: 'Model not compatible with transformers.js. Only models with library "transformers.js" are supported (e.g., models from Xenova).'
                };
            }

            // Calculate total download size from ONNX files
            const siblings = data.siblings || [];
            const onnxFiles = siblings.filter(file =>
                file.rfilename && file.rfilename.endsWith('.onnx')
            );
            const totalSize = onnxFiles.reduce((sum, file) => sum + (file.size || 0), 0);

            // Try to extract parameter count from tags or model name
            let paramCount = null;
            const tags = data.tags || [];
            const paramTag = tags.find(tag => tag.includes('parameters:'));
            if (paramTag) {
                const match = paramTag.match(/parameters:(\d+[BMK]?)/i);
                if (match) paramCount = match[1];
            }
            // Try to extract from model name (e.g., "110M", "1.1B")
            if (!paramCount) {
                const nameMatch = modelId.match(/(\d+\.?\d*[BMK])/i);
                if (nameMatch) paramCount = nameMatch[1];
            }

            // Extract useful info for the card
            return {
                success: true,
                modelInfo: {
                    id: data.id || modelId,
                    name: modelId.split('/').pop(),
                    author: data.author || modelId.split('/')[0],
                    description: data.cardData?.short_description || 'Custom model from Hugging Face',
                    parameters: paramCount,
                    downloadSize: totalSize,
                    pipeline_tag: data.pipeline_tag || 'text-generation',
                    library_name: data.library_name
                }
            };

        } catch (error) {
            if (error.name === 'AbortError') {
                return { success: false, error: null }; // Cancelled, no error to show
            }
            console.error('Validation error:', error);
            return { success: false, error: 'Network error. Check your connection.' };
        }
    }

    createCustomModelCard(modelInfo) {
        const card = document.createElement('label');
        card.className = 'model-card custom-model-card';

        // Build stats HTML
        let statsHtml = '';
        if (modelInfo.parameters) {
            statsHtml += `<span class="stat"><strong>${this.escapeHtml(modelInfo.parameters)}</strong> parameters</span>`;
        }
        if (modelInfo.downloadSize && modelInfo.downloadSize > 0) {
            statsHtml += `<span class="stat"><strong>~${this.formatBytes(modelInfo.downloadSize)}</strong> download</span>`;
        }
        // Fallback if we don't have parameter/size info
        if (!statsHtml) {
            statsHtml = `<span class="stat"><strong>${this.escapeHtml(modelInfo.author)}</strong></span>`;
        }

        card.innerHTML = `
            <input type="radio" name="model" value="${modelInfo.id}">
            <div class="model-info">
                <div class="model-name">
                    ${this.escapeHtml(modelInfo.name)}
                    <span class="badge custom">Custom</span>
                </div>
                <div class="model-description">${this.escapeHtml(modelInfo.description)}</div>
                <div class="model-stats">
                    ${statsHtml}
                </div>
            </div>
            <button class="remove-custom-model" data-model-id="${modelInfo.id}" title="Remove">×</button>
        `;

        // Add event listener for the radio button
        const radio = card.querySelector('input[type="radio"]');
        radio.addEventListener('change', () => {
            this.loadModelBtn.disabled = false;
        });

        // Add event listener for remove button
        const removeBtn = card.querySelector('.remove-custom-model');
        removeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.removeCustomModel(modelInfo.id);
        });

        return card;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }

    formatBytes(bytes) {
        if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + 'GB';
        if (bytes >= 1048576) return (bytes / 1048576).toFixed(0) + 'MB';
        if (bytes >= 1024) return (bytes / 1024).toFixed(0) + 'KB';
        return bytes + 'B';
    }

    handleCustomModelInput(value) {
        const { isValid, error } = this.parseHuggingFaceUrl(value);

        if (!value.trim()) {
            this.validateBtn.disabled = true;
            this.customModelFeedback.classList.add('hidden');
            this.customModelUrl.classList.remove('valid', 'invalid');
            return;
        }

        if (isValid) {
            this.validateBtn.disabled = false;
            this.customModelUrl.classList.remove('invalid');
            this.customModelUrl.classList.add('valid');
            this.customModelFeedback.classList.add('hidden');
        } else {
            this.validateBtn.disabled = true;
            this.customModelUrl.classList.remove('valid');
            this.customModelUrl.classList.add('invalid');
            this.showFeedback(error, 'error');
        }
    }

    async handleValidateCustomModel() {
        const url = this.customModelUrl.value;
        const { modelId } = this.parseHuggingFaceUrl(url);

        if (!modelId) return;

        // Check if already added
        if (this.customModels.has(modelId)) {
            this.showFeedback('This model is already added.', 'warning');
            return;
        }

        // Show loading state
        this.validateBtn.disabled = true;
        this.validateBtn.textContent = 'Validating...';
        this.showFeedback('Checking model compatibility...', 'loading');

        const result = await this.validateModel(modelId);

        // Reset button
        this.validateBtn.textContent = 'Validate';
        this.validateBtn.disabled = false;

        if (result.success) {
            // Add to custom models
            this.customModels.set(modelId, result.modelInfo);

            // Create and insert card
            const card = this.createCustomModelCard(result.modelInfo);
            this.customModelCards.appendChild(card);

            // Update modelRadios to include new radio button
            this.modelRadios = document.querySelectorAll('input[name="model"]');

            // Clear input
            this.customModelUrl.value = '';
            this.customModelUrl.classList.remove('valid');

            // Show success and auto-select
            this.showFeedback(`Added ${result.modelInfo.name}! Select it to load.`, 'success');

            // Auto-select the new model
            const radio = card.querySelector('input[type="radio"]');
            radio.checked = true;
            this.loadModelBtn.disabled = false;

            // Hide feedback after delay
            setTimeout(() => {
                this.customModelFeedback.classList.add('hidden');
            }, 3000);
        } else if (result.error) {
            this.showFeedback(result.error, 'error');
        }
    }

    showFeedback(message, type) {
        this.customModelFeedback.textContent = message;
        this.customModelFeedback.className = `custom-model-feedback ${type}`;
        this.customModelFeedback.classList.remove('hidden');
    }

    removeCustomModel(modelId) {
        this.customModels.delete(modelId);
        const card = this.customModelCards.querySelector(`input[value="${modelId}"]`)?.closest('.model-card');
        if (card) {
            card.remove();
        }

        // Update modelRadios to reflect removal
        this.modelRadios = document.querySelectorAll('input[name="model"]');

        // If this was selected, disable load button
        if (!this.getSelectedModel()) {
            this.loadModelBtn.disabled = true;
        }
    }
}

// Initialize the playground
// ES6 modules are deferred by default, so DOM is already ready
new LLMPlayground();
