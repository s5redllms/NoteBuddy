// Global state
let currentNoteId = null;
let todos = [];
let notes = [];
let quillEditor = null;
let isAIPanelHidden = false;

// DOM elements
const todoInput = document.getElementById('todo-input');
const addTodoBtn = document.getElementById('add-todo-btn');
const todosList = document.getElementById('todos-list');
const addNoteBtn = document.getElementById('add-note-btn');
const notesList = document.getElementById('notes-list');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');
const chatMessages = document.getElementById('chat-messages');
const conversationSelect = document.getElementById('conversation-select');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const panelToggleBtn = document.getElementById('panel-toggle-btn');
const mainContainer = document.querySelector('.main-container');
const noteModal = document.getElementById('note-modal');
const noteTitleInput = document.getElementById('note-title-input');
const noteContentInput = document.getElementById('note-content-input');
const saveNoteBtn = document.getElementById('save-note-btn');
const cancelNoteBtn = document.getElementById('cancel-note-btn');
const closeModalBtn = document.querySelector('.close-modal');
const modalTitle = document.getElementById('modal-title');

// Tab switching
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeTheme();
    initializePanelState();
    setupEventListeners();
    setupResponsiveHandlers();
    
    // Initialize rich text editor after DOM is ready
    setTimeout(() => {
        initializeRichTextEditor();
    }, 100);
    
    loadTodos();
    loadNotes();
    loadConversations();
    loadChatHistory();
    
    // Initial responsive setup
    handleResponsiveLayout();
});

// Theme management
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.classList.toggle('dark-mode', savedTheme === 'dark');
    themeToggleBtn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    themeToggleBtn.textContent = isDark ? '☀️' : '🌙';
}

// Panel toggle functionality
function toggleAIPanel() {
    isAIPanelHidden = !isAIPanelHidden;
    mainContainer.classList.toggle('ai-hidden', isAIPanelHidden);
    
    // Save state
    localStorage.setItem('aiPanelHidden', isAIPanelHidden);
}

// Initialize panel state
function initializePanelState() {
    const savedState = localStorage.getItem('aiPanelHidden');
    if (savedState === 'true') {
        isAIPanelHidden = true;
        mainContainer.classList.add('ai-hidden');
    }
}

// Event listeners setup
function setupEventListeners() {
    // Theme toggle
    themeToggleBtn.addEventListener('click', toggleTheme);
    
    // Panel toggle
    panelToggleBtn.addEventListener('click', toggleAIPanel);
    
    // Tab switching
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    
    // Todo functionality
    addTodoBtn.addEventListener('click', addTodo);
    todoInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTodo();
    });
    
    // Note functionality
    addNoteBtn.addEventListener('click', () => openNoteModal());
    saveNoteBtn.addEventListener('click', saveNote);
    cancelNoteBtn.addEventListener('click', closeNoteModal);
    closeModalBtn.addEventListener('click', closeNoteModal);
    
    // Chat functionality
    sendChatBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    conversationSelect.addEventListener('change', () => {
        loadSelectedConversation();
        updateDeleteButtonVisibility();
    });
    
    // Delete conversation functionality
    document.getElementById('delete-conversation-btn').addEventListener('click', deleteSelectedConversation);
    
    // Modal close on background click
    noteModal.addEventListener('click', (e) => {
        if (e.target === noteModal) closeNoteModal();
    });
}

// Tab switching
function switchTab(tabName) {
    tabBtns.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

// Todo functionality
async function loadTodos() {
    try {
        const response = await fetch('/api/todos');
        if (response.ok) {
            todos = await response.json();
            renderTodos();
        }
    } catch (error) {
        console.error('Error loading todos:', error);
    }
}

function renderTodos() {
    if (todos.length === 0) {
        todosList.innerHTML = '<div class="empty-state"><p>No todos yet. Add one above!</p></div>';
        return;
    }
    
    todosList.innerHTML = todos.map(todo => `
        <div class="todo-item ${todo.completed ? 'completed' : ''}" data-id="${todo.id}">
            <input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''} 
                   onchange="toggleTodo(${todo.id}, this.checked)">
            <span class="todo-text">${escapeHtml(todo.title)}</span>
            <button class="delete-btn" onclick="deleteTodo(${todo.id})">×</button>
        </div>
    `).join('');
}

async function addTodo() {
    const title = todoInput.value.trim();
    if (!title) return;
    
    try {
        const response = await fetch('/api/todos', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ title })
        });
        
        if (response.ok) {
            const newTodo = await response.json();
            todos.unshift(newTodo);
            todoInput.value = '';
            renderTodos();
        }
    } catch (error) {
        console.error('Error adding todo:', error);
    }
}

async function toggleTodo(todoId, completed) {
    try {
        const response = await fetch(`/api/todos/${todoId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ completed })
        });
        
        if (response.ok) {
            const todo = todos.find(t => t.id === todoId);
            if (todo) {
                todo.completed = completed;
                renderTodos();
            }
        }
    } catch (error) {
        console.error('Error updating todo:', error);
    }
}

async function deleteTodo(todoId) {
    try {
        const response = await fetch(`/api/todos/${todoId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            todos = todos.filter(t => t.id !== todoId);
            renderTodos();
        }
    } catch (error) {
        console.error('Error deleting todo:', error);
    }
}

// Notes functionality
async function loadNotes() {
    try {
        const response = await fetch('/api/notes');
        if (response.ok) {
            notes = await response.json();
            renderNotes();
        }
    } catch (error) {
        console.error('Error loading notes:', error);
    }
}

function renderNotes() {
    if (notes.length === 0) {
        notesList.innerHTML = '<div class="empty-state"><p>No notes yet. Create one!</p></div>';
        return;
    }
    
    notesList.innerHTML = notes.map(note => {
        const date = new Date(note.updated_at).toLocaleDateString();
        
        let preview = 'No content';
        if (note.content) {
            try {
                // Try to parse rich text content
                const parsedContent = JSON.parse(note.content);
                preview = parsedContent.text ? parsedContent.text.substring(0, 100) + '...' : 'No content';
            } catch {
                // Fallback to plain text
                preview = note.content.substring(0, 100) + '...';
            }
        }
        
        return `
            <div class="note-item" onclick="openNoteModal(${note.id})">
                <div class="note-header">
                    <span class="note-title">${escapeHtml(note.title)}</span>
                    <span class="note-date">${date}</span>
                </div>
                <div class="note-preview">${escapeHtml(preview)}</div>
            </div>
        `;
    }).join('');
}

// Rich Text Editor Management
function initializeRichTextEditor() {
    // Initialize Quill editor
    quillEditor = new Quill('#quill-editor', {
        theme: 'snow',
        modules: {
            toolbar: false // We'll use custom toolbar
        },
        placeholder: 'Start writing your note...'
    });
    
    // Update word count on text change
    quillEditor.on('text-change', updateWordCount);
    
    // Setup custom toolbar
    setupCustomToolbar();
}

function setupCustomToolbar() {
    // Basic formatting
    document.getElementById('bold-btn').addEventListener('click', () => {
        quillEditor.format('bold', !quillEditor.getFormat().bold);
        updateToolbarState();
    });
    
    document.getElementById('italic-btn').addEventListener('click', () => {
        quillEditor.format('italic', !quillEditor.getFormat().italic);
        updateToolbarState();
    });
    
    document.getElementById('underline-btn').addEventListener('click', () => {
        quillEditor.format('underline', !quillEditor.getFormat().underline);
        updateToolbarState();
    });
    
    // Font family
    document.getElementById('font-family').addEventListener('change', (e) => {
        quillEditor.format('font', e.target.value);
    });
    
    // Font size
    document.getElementById('font-size').addEventListener('change', (e) => {
        quillEditor.format('size', e.target.value);
    });
    
    // Text alignment
    document.getElementById('align-left').addEventListener('click', () => {
        quillEditor.format('align', false);
        updateToolbarState();
    });
    
    document.getElementById('align-center').addEventListener('click', () => {
        quillEditor.format('align', 'center');
        updateToolbarState();
    });
    
    document.getElementById('align-right').addEventListener('click', () => {
        quillEditor.format('align', 'right');
        updateToolbarState();
    });
    
    document.getElementById('align-justify').addEventListener('click', () => {
        quillEditor.format('align', 'justify');
        updateToolbarState();
    });
    
    // Lists
    document.getElementById('bullet-list').addEventListener('click', () => {
        quillEditor.format('list', 'bullet');
        updateToolbarState();
    });
    
    document.getElementById('number-list').addEventListener('click', () => {
        quillEditor.format('list', 'ordered');
        updateToolbarState();
    });
    
    // Colors
    document.getElementById('text-color').addEventListener('change', (e) => {
        quillEditor.format('color', e.target.value);
    });
    
    document.getElementById('bg-color').addEventListener('change', (e) => {
        quillEditor.format('background', e.target.value);
    });
    
    // Undo/Redo
    document.getElementById('undo-btn').addEventListener('click', () => {
        quillEditor.history.undo();
    });
    
    document.getElementById('redo-btn').addEventListener('click', () => {
        quillEditor.history.redo();
    });
    
    // Find & Replace
    document.getElementById('find-replace-btn').addEventListener('click', showFindReplaceDialog);
    
    // Code formatting
    document.getElementById('code-block-btn').addEventListener('click', insertCodeBlock);
    document.getElementById('inline-code-btn').addEventListener('click', insertInlineCode);
    
    // Export functions
    document.getElementById('export-pdf-btn').addEventListener('click', exportToPDF);
    document.getElementById('export-docx-btn').addEventListener('click', exportToDocx);
    document.getElementById('print-btn').addEventListener('click', printDocument);
}

function updateToolbarState() {
    const format = quillEditor.getFormat();
    
    // Update button states
    document.getElementById('bold-btn').classList.toggle('active', !!format.bold);
    document.getElementById('italic-btn').classList.toggle('active', !!format.italic);
    document.getElementById('underline-btn').classList.toggle('active', !!format.underline);
    
    // Update alignment buttons
    document.querySelectorAll('[id^="align-"]').forEach(btn => btn.classList.remove('active'));
    if (format.align) {
        document.getElementById(`align-${format.align}`).classList.add('active');
    } else {
        document.getElementById('align-left').classList.add('active');
    }
    
    // Update list buttons
    document.getElementById('bullet-list').classList.toggle('active', format.list === 'bullet');
    document.getElementById('number-list').classList.toggle('active', format.list === 'ordered');
}

function updateWordCount() {
    const text = quillEditor.getText();
    const wordCount = text.trim().split(/\s+/).filter(word => word.length > 0).length;
    document.getElementById('word-count').textContent = `${wordCount} words`;
}

function openNoteModal(noteId = null) {
    currentNoteId = noteId;
    
    if (noteId) {
        const note = notes.find(n => n.id === noteId);
        if (note) {
            modalTitle.textContent = 'Edit Note';
            noteTitleInput.value = note.title;
            
            // Set content in Quill editor
            if (note.content) {
                try {
                    // Try to parse as rich text JSON
                    const parsedContent = JSON.parse(note.content);
                    if (parsedContent.delta) {
                        quillEditor.setContents(parsedContent.delta);
                    } else {
                        quillEditor.setText(parsedContent.text || note.content);
                    }
                } catch {
                    // Fallback to plain text
                    quillEditor.setText(note.content);
                }
            } else {
                quillEditor.setText('');
            }
        }
    } else {
        modalTitle.textContent = 'New Note';
        noteTitleInput.value = '';
        quillEditor.setText('');
    }
    
    noteModal.style.display = 'block';
    noteTitleInput.focus();
    updateWordCount();
    updateToolbarState();
}

function closeNoteModal() {
    noteModal.style.display = 'none';
    currentNoteId = null;
}

async function saveNote() {
    const title = noteTitleInput.value.trim();
    
    // Get rich text content from Quill editor
    const delta = quillEditor.getContents();
    const htmlContent = quillEditor.root.innerHTML;
    
    // Store both delta (for editing) and HTML (for preview)
    const content = JSON.stringify({
        delta: delta,
        html: htmlContent,
        text: quillEditor.getText()
    });
    
    if (!title) {
        alert('Please enter a title for your note.');
        return;
    }
    
    try {
        let response;
        if (currentNoteId) {
            // Update existing note
            response = await fetch(`/api/notes/${currentNoteId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ title, content })
            });
        } else {
            // Create new note
            response = await fetch('/api/notes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ title, content })
            });
        }
        
        if (response.ok) {
            closeNoteModal();
            loadNotes(); // Reload notes to get updated data
            showActionFeedback('Note saved successfully!');
        }
    } catch (error) {
        console.error('Error saving note:', error);
        showActionFeedback('Error saving note', 'error');
    }
}

async function deleteNote(noteId) {
    if (!confirm('Are you sure you want to delete this note?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/notes/${noteId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            notes = notes.filter(n => n.id !== noteId);
            renderNotes();
        }
    } catch (error) {
        console.error('Error deleting note:', error);
    }
}

// Chat functionality
async function loadChatHistory() {
    // Don't load chat history - start with empty current session
    showEmptyState();
}

async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;
    
    // Add user message to chat
    appendMessage(message, 'user');
    chatInput.value = '';
    
    // Show typing indicator
    const typingIndicator = showTypingIndicator();
    
    // Disable send button
    sendChatBtn.disabled = true;
    sendChatBtn.textContent = 'Sending...';
    
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message })
        });
        
        if (response.ok) {
            const data = await response.json();
            removeTypingIndicator(typingIndicator);
            appendMessage(data.response, 'ai');
            
            // Auto-save conversation after every AI response
            await autoSaveConversation();
        } else {
            removeTypingIndicator(typingIndicator);
            appendMessage('Sorry, there was an error processing your message.', 'ai');
        }
    } catch (error) {
        console.error('Error sending message:', error);
        removeTypingIndicator(typingIndicator);
        appendMessage('Sorry, I am currently unavailable.', 'ai');
    } finally {
        sendChatBtn.disabled = false;
        sendChatBtn.textContent = 'Send';
    }
}

// Format AI responses with markdown and code support
function formatAIResponse(text) {
    // First escape HTML to prevent XSS
    const div = document.createElement('div');
    div.textContent = text;
    let escapedText = div.innerHTML;
    
    // Handle code blocks first (```language\ncode\n```)
    escapedText = escapedText.replace(/```(\w+)?\n([\s\S]*?)\n```/g, (match, language, code) => {
        const lang = language || 'plain';
        const codeId = 'code-' + Math.random().toString(36).substr(2, 9);
        return `<div class="code-block-container"><pre class="code-block language-${lang}" data-language="${lang}"><code class="language-${lang}" id="${codeId}">${code}</code></pre><button class="copy-code-btn" onclick="copyCode('${codeId}')">Copy</button><span class="language-label">${lang.toUpperCase()}</span></div>`;
    });
    
    // Handle inline code (`code`)
    escapedText = escapedText.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
    
    // Convert **text** to <strong>text</strong>
    escapedText = escapedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Convert *text* to <em>text</em>
    escapedText = escapedText.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    // Split by double line breaks to create paragraphs
    const paragraphs = escapedText.split(/\n\s*\n/);
    
    // Process each paragraph and eliminate all whitespace between elements
    const processedParagraphs = paragraphs.map(paragraph => {
        // Skip empty paragraphs
        const trimmed = paragraph.trim();
        if (!trimmed) return '';
        
        // If it's a code block, return as-is
        if (trimmed.startsWith('<div class="code-block-container">')) {
            return trimmed;
        }
        
        // Convert single line breaks to <br> within paragraphs
        const withBreaks = trimmed.replace(/\n/g, '<br>');
        
        // Wrap in paragraph tags
        return `<p>${withBreaks}</p>`;
    }).filter(p => p); // Remove empty paragraphs
    
    // Join without any whitespace to eliminate selectable empty spaces
    return processedParagraphs.join('').replace(/>\s+</g, '><');
}


function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'typing-indicator';
    typingDiv.innerHTML = `
        <span>AI is typing</span>
        <div class="typing-dots">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        </div>
    `;
    
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return typingDiv;
}

function removeTypingIndicator(indicator) {
    if (indicator && indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
    }
}

// Conversation management
let currentConversationId = null;
let conversations = [];
let currentSessionMessages = []; // Track messages in current session
let isCurrentSession = true; // Track if we're in current session

async function loadConversations() {
    try {
        const response = await fetch('/api/conversations');
        if (response.ok) {
            conversations = await response.json();
            renderConversationSelect();
        }
    } catch (error) {
        console.error('Error loading conversations:', error);
    }
}

function renderConversationSelect() {
    // Clear existing options except "Current Chat"
    conversationSelect.innerHTML = '<option value="current">Current Chat</option>';
    
    // Add saved conversations
    conversations.forEach(conv => {
        const date = new Date(conv.updated_at).toLocaleDateString();
        const option = document.createElement('option');
        option.value = conv.id;
        option.textContent = `${conv.title} (${date})`;
        conversationSelect.appendChild(option);
    });
    
    // Show/hide delete button based on selection
    updateDeleteButtonVisibility();
}

function updateDeleteButtonVisibility() {
    const deleteBtn = document.getElementById('delete-conversation-btn');
    const selectedValue = conversationSelect.value;
    
    if (selectedValue === 'current') {
        deleteBtn.style.display = 'none';
    } else {
        deleteBtn.style.display = 'flex';
    }
}

async function deleteSelectedConversation() {
    const selectedValue = conversationSelect.value;
    
    if (selectedValue === 'current') {
        return;
    }
    
    const conversation = conversations.find(conv => conv.id == selectedValue);
    if (!conversation) {
        return;
    }
    
    if (!confirm(`Are you sure you want to delete the conversation "${conversation.title}"? This action cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/conversations/${selectedValue}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            // Remove from local array
            conversations = conversations.filter(conv => conv.id != selectedValue);
            
            // Switch to current chat
            conversationSelect.value = 'current';
            startNewCurrentSession();
            
            // Update conversation list
            renderConversationSelect();
            
            showActionFeedback('Conversation deleted successfully!');
        } else {
            showActionFeedback('Error deleting conversation', 'error');
        }
    } catch (error) {
        console.error('Error deleting conversation:', error);
        showActionFeedback('Error deleting conversation', 'error');
    }
}

async function autoSaveConversation() {
    // Auto-save after every message exchange (user + AI response)
    if (currentSessionMessages.length < 2) {
        return; // Wait until we have at least one exchange
    }
    
    // Generate a title based on the first user message
    const firstUserMessage = currentSessionMessages.find(m => m.sender === 'user');
    const title = firstUserMessage ? 
        firstUserMessage.content.substring(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '') :
        `Chat ${new Date().toLocaleDateString()}`;
    
    try {
        const response = await fetch('/api/conversations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                title, 
                messages: currentSessionMessages,
                conversation_id: currentConversationId 
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (!currentConversationId) {
                // First save - switch to this conversation
                currentConversationId = data.id;
                isCurrentSession = false;
                
                // Add to conversation list and select it
                await loadConversations();
                conversationSelect.value = currentConversationId;
                
                showActionFeedback(`Conversation auto-saved: ${title}`);
            }
        }
    } catch (error) {
        console.error('Error auto-saving conversation:', error);
    }
}

async function loadSelectedConversation() {
    const selectedValue = conversationSelect.value;
    
    if (selectedValue === 'current') {
        // Start fresh current session - completely empty
        startNewCurrentSession();
        return;
    }
    
    try {
        const response = await fetch(`/api/conversations/${selectedValue}`);
        if (response.ok) {
            const conversation = await response.json();
            currentConversationId = conversation.id;
            isCurrentSession = false;
            currentSessionMessages = [...conversation.messages]; // Copy existing messages
            
            // Clear all messages and load saved conversation
            clearAllMessages();
            
            // Load saved messages without adding them to currentSessionMessages again
            conversation.messages.forEach(msg => {
                appendMessageToUI(msg.content, msg.sender, false);
            });
            
            showActionFeedback(`Loaded: ${conversation.title}`);
        } else {
            showActionFeedback('Error loading conversation', 'error');
        }
    } catch (error) {
        console.error('Error loading conversation:', error);
        showActionFeedback('Error loading conversation', 'error');
    }
}

function startNewCurrentSession() {
    currentConversationId = null;
    isCurrentSession = true;
    currentSessionMessages = [];
    showEmptyState();
}

function showEmptyState() {
    chatMessages.innerHTML = `
        <div class="empty-chat-state" id="empty-chat-state">
            <div class="empty-chat-message">
                <p>Start a new conversation by typing a message below.</p>
            </div>
        </div>
    `;
}

function clearAllMessages() {
    chatMessages.innerHTML = '';
}

// Function to display messages in UI without tracking them (for loading saved conversations)
function appendMessageToUI(content, sender, animate = true) {
    // Remove empty state when first message is sent
    const emptyState = document.getElementById('empty-chat-state');
    if (emptyState) {
        emptyState.remove();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `${sender}-message${animate ? ' fade-in' : ''}`;
    
    // Format AI responses differently than user messages
    const formattedContent = sender === 'ai' ? formatAIResponse(content) : `<p>${escapeHtml(content)}</p>`;
    
    // Create message content without any whitespace
    messageDiv.innerHTML = `<div class="message-content">${formattedContent}</div>`;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Apply syntax highlighting to any code blocks
    if (sender === 'ai' && window.Prism) {
        const codeBlocks = messageDiv.querySelectorAll('code[class*="language-"]');
        codeBlocks.forEach(block => {
            Prism.highlightElement(block);
        });
    }
}

// Function to append new messages and track them for saving
async function appendMessage(content, sender, animate = true) {
    // Display the message in UI
    appendMessageToUI(content, sender, animate);
    
    // Track messages for current session
    if (isCurrentSession) {
        currentSessionMessages.push({ content, sender });
    } else if (currentConversationId) {
        // Update messages for existing conversation
        currentSessionMessages.push({ content, sender });
        // Auto-save after every message when in existing conversation
        if (sender === 'ai') {
            await autoSaveConversation();
        }
    }
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

// Dynamic chat input sizing
function updateChatInputSize() {
    const maxHeight = window.innerWidth <= 768 ? Math.min(80, window.innerHeight * 0.12) : Math.min(100, window.innerHeight * 0.15);
    chatInput.style.maxHeight = maxHeight + 'px';
}

// Auto-resize chat textarea
chatInput.addEventListener('input', function() {
    this.style.height = 'auto';
    const maxHeight = window.innerWidth <= 768 ? Math.min(80, window.innerHeight * 0.12) : Math.min(100, window.innerHeight * 0.15);
    this.style.height = Math.min(this.scrollHeight, maxHeight) + 'px';
});

// Context menu for notes (right-click to delete)
document.addEventListener('contextmenu', function(e) {
    const noteItem = e.target.closest('.note-item');
    if (noteItem) {
        e.preventDefault();
        const noteId = parseInt(noteItem.onclick.toString().match(/\d+/)[0]);
        if (confirm('Delete this note?')) {
            deleteNote(noteId);
        }
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + N for new note
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        if (document.querySelector('[data-tab="notes"]').classList.contains('active')) {
            openNoteModal();
        }
    }
    
    // Escape to close modal
    if (e.key === 'Escape' && noteModal.style.display === 'block') {
        closeNoteModal();
    }
    
    // Ctrl/Cmd + Enter to save note
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && noteModal.style.display === 'block') {
        e.preventDefault();
        saveNote();
    }
});

// Error handling for fetch requests
function handleFetchError(error, action) {
    console.error(`Error ${action}:`, error);
    
    // Show user-friendly error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'flash-message';
    errorDiv.textContent = `Error ${action}. Please try again.`;
    errorDiv.style.position = 'fixed';
    errorDiv.style.top = '70px';
    errorDiv.style.right = '20px';
    errorDiv.style.zIndex = '1001';
    errorDiv.style.maxWidth = '300px';
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.parentNode.removeChild(errorDiv);
        }
    }, 3000);
}

// Auto-save for notes (save draft every 30 seconds)
let noteSaveTimeout;
function scheduleNoteSave() {
    clearTimeout(noteSaveTimeout);
    noteSaveTimeout = setTimeout(() => {
        if (noteModal.style.display === 'block' && currentNoteId) {
            const title = noteTitleInput.value.trim();
            const content = noteContentInput.value.trim();
            
            if (title && (title !== '' || content !== '')) {
                saveNote();
            }
        }
    }, 30000);
}

noteTitleInput.addEventListener('input', scheduleNoteSave);
noteContentInput.addEventListener('input', scheduleNoteSave);

// Advanced Document Editor Features
function showFindReplaceDialog() {
    const findText = prompt('Find:');
    if (!findText) return;
    
    const replaceText = prompt('Replace with:');
    if (replaceText === null) return; // User cancelled
    
    const text = quillEditor.getText();
    const regex = new RegExp(findText, 'gi');
    const newText = text.replace(regex, replaceText);
    
    if (newText !== text) {
        quillEditor.setText(newText);
        showActionFeedback(`Replaced ${findText} with ${replaceText}`);
    } else {
        showActionFeedback('Text not found', 'error');
    }
}

async function exportToPDF() {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        const title = noteTitleInput.value.trim() || 'Untitled Note';
        const content = quillEditor.getText();
        
        // Add title
        doc.setFontSize(16);
        doc.text(title, 20, 30);
        
        // Add content
        doc.setFontSize(12);
        const splitText = doc.splitTextToSize(content, 170);
        doc.text(splitText, 20, 50);
        
        // Save the PDF
        doc.save(`${title}.pdf`);
        showActionFeedback('PDF exported successfully!');
    } catch (error) {
        console.error('Error exporting PDF:', error);
        showActionFeedback('Error exporting PDF', 'error');
    }
}

function exportToDocx() {
    // Simple DOCX export using HTML conversion
    const title = noteTitleInput.value.trim() || 'Untitled Note';
    const htmlContent = quillEditor.root.innerHTML;
    
    const docContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${title}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1 { margin-bottom: 20px; }
            </style>
        </head>
        <body>
            <h1>${title}</h1>
            ${htmlContent}
        </body>
        </html>
    `;
    
    const blob = new Blob([docContent], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.html`; // Note: This will download as HTML, not true DOCX
    a.click();
    URL.revokeObjectURL(url);
    
    showActionFeedback('Document exported successfully!');
}

function printDocument() {
    const title = noteTitleInput.value.trim() || 'Untitled Note';
    const htmlContent = quillEditor.root.innerHTML;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${title}</title>
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    margin: 20px; 
                    line-height: 1.6;
                }
                h1 { margin-bottom: 20px; }
                @media print {
                    body { margin: 0; padding: 20px; }
                }
            </style>
        </head>
        <body>
            <h1>${title}</h1>
            ${htmlContent}
        </body>
        </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 250);
    
    showActionFeedback('Print dialog opened!');
}

// Responsive layout handlers
function setupResponsiveHandlers() {
    // Handle window resize
    let resizeTimeout;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            handleResponsiveLayout();
            updateChatInputSize();
            adjustModalSize();
        }, 100);
    });
    
    // Handle orientation change on mobile
    window.addEventListener('orientationchange', function() {
        setTimeout(() => {
            handleResponsiveLayout();
            updateChatInputSize();
            adjustModalSize();
        }, 300);
    });
}

function handleResponsiveLayout() {
    const isMobile = window.innerWidth <= 768;
    const isTablet = window.innerWidth > 768 && window.innerWidth <= 1024;
    
    // Adjust panel toggle behavior for mobile
    if (isMobile) {
        // On mobile, AI panel toggle works vertically
        panelToggleBtn.innerHTML = '<span class="toggle-arrow">' + (isAIPanelHidden ? '▲' : '▼') + '</span> ' + (isAIPanelHidden ? 'Show AI Assistant' : 'Hide AI Assistant');
    } else {
        // On desktop, AI panel toggle works horizontally
        panelToggleBtn.innerHTML = '<span class="toggle-arrow">' + (isAIPanelHidden ? '▶' : '◀') + '</span>';
        panelToggleBtn.title = isAIPanelHidden ? 'Show AI Assistant' : 'Hide AI Assistant';
    }
    
    // Adjust chat messages max width based on screen size
    const messages = document.querySelectorAll('.user-message, .ai-message');
    messages.forEach(msg => {
        if (isMobile) {
            msg.style.maxWidth = '95%';
        } else {
            msg.style.maxWidth = '80%';
        }
    });
}

function adjustModalSize() {
    if (noteModal.style.display === 'block') {
        const modalContent = noteModal.querySelector('.modal-content');
        if (window.innerWidth <= 480) {
            modalContent.style.width = '100vw';
            modalContent.style.height = '100vh';
            modalContent.style.margin = '0';
            modalContent.style.borderRadius = '0';
        } else if (window.innerWidth <= 768) {
            modalContent.style.width = '98vw';
            modalContent.style.height = '95vh';
            modalContent.style.margin = '2.5vh auto';
        } else {
            modalContent.style.width = 'min(95vw, 1000px)';
            modalContent.style.height = '90vh';
            modalContent.style.margin = 'max(2vh, 20px) auto';
        }
    }
}

// Programming-specific functions for rich text editor
function insertCodeBlock() {
    const language = document.getElementById('code-language').value || 'javascript';
    const selection = quillEditor.getSelection();
    
    if (selection) {
        // Get selected text or use placeholder
        const selectedText = quillEditor.getText(selection.index, selection.length) || '// Your code here';
        
        // Create code block HTML
        const codeBlockHtml = `<pre class="ql-code-block" data-language="${language}">${selectedText}</pre>`;
        
        // Insert code block
        quillEditor.clipboard.dangerouslyPasteHTML(selection.index, codeBlockHtml);
        
        // Move cursor after the code block
        quillEditor.setSelection(selection.index + selectedText.length + 1);
    }
    
    showActionFeedback(`${language.toUpperCase()} code block inserted`);
}

function insertInlineCode() {
    const selection = quillEditor.getSelection();
    
    if (selection) {
        if (selection.length > 0) {
            // Format selected text as inline code
            quillEditor.format('code', true);
        } else {
            // Insert inline code placeholder
            quillEditor.insertText(selection.index, 'code', 'code', true);
            quillEditor.setSelection(selection.index, 4);
        }
    }
    
    showActionFeedback('Inline code formatting applied');
}

// Copy code function for code blocks in chat
function copyCode(codeId) {
    const codeElement = document.getElementById(codeId);
    if (codeElement) {
        const text = codeElement.textContent;
        
        navigator.clipboard.writeText(text).then(() => {
            showActionFeedback('Code copied to clipboard!');
        }).catch(() => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showActionFeedback('Code copied to clipboard!');
        });
    }
}

// Enhanced code detection for different programming patterns
function detectCodeLanguage(code) {
    // Simple language detection based on common patterns
    if (code.includes('function ') || code.includes('const ') || code.includes('let ') || code.includes('var ')) {
        return 'javascript';
    }
    if (code.includes('def ') || code.includes('import ') || code.includes('print(')) {
        return 'python';
    }
    if (code.includes('<html>') || code.includes('<!DOCTYPE') || code.includes('<div')) {
        return 'html';
    }
    if (code.includes('SELECT ') || code.includes('FROM ') || code.includes('WHERE ')) {
        return 'sql';
    }
    if (code.includes('class ') || code.includes('public ') || code.includes('private ')) {
        return 'java';
    }
    if (code.includes('<?php') || code.includes('$_')) {
        return 'php';
    }
    if (code.includes('#include') || code.includes('int main')) {
        return 'c';
    }
    return 'plain';
}

// Add visual feedback for actions
function showActionFeedback(message, type = 'success') {
    const feedbackDiv = document.createElement('div');
    feedbackDiv.className = `action-feedback ${type}`;
    feedbackDiv.textContent = message;
    
    // Dynamic positioning based on screen size
    const topOffset = window.innerWidth <= 768 ? 'max(55px, 8vh)' : 'max(70px, 10vh)';
    
    feedbackDiv.style.cssText = `
        position: fixed;
        top: ${topOffset};
        left: 50%;
        transform: translateX(-50%);
        background: var(--bg-secondary);
        color: var(--text-primary);
        padding: 0.5rem 1rem;
        border: 1px solid var(--border-color);
        border-radius: 4px;
        z-index: 1001;
        animation: fadeIn 0.3s ease-in;
        max-width: 90vw;
        text-align: center;
    `;
    
    document.body.appendChild(feedbackDiv);
    
    setTimeout(() => {
        feedbackDiv.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => {
            if (feedbackDiv.parentNode) {
                feedbackDiv.parentNode.removeChild(feedbackDiv);
            }
        }, 300);
    }, 2000);
}

