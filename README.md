# Todo AI App

A minimalistic web application combining a todo/notes manager with an AI chatbot powered by Ollama.

## Features

- **Split-screen design**: Todo/Notes app on the left, AI chatbot on the right
- **User authentication**: Login and registration system
- **Todo management**: Add, complete, and delete todos
- **Note taking**: Create, edit, and delete notes with full content editor
- **AI chatbot**: Powered by Ollama for conversational AI
- **Theme switching**: Light and dark mode support
- **Responsive design**: Works on desktop and mobile
- **Minimalistic UI**: Clean monochrome design with thin borders and white spaces

## Prerequisites

1. **Python 3.7+**
2. **Ollama**: Install and run Ollama with a language model
   - Install Ollama from https://ollama.ai/
   - Pull a model: `ollama pull llama3.2` (or any model you prefer)
   - Make sure Ollama is running on `http://localhost:11434`

## Setup

1. **Clone/Download the project**
   ```bash
   cd todo-ai-app
   ```

2. **Install Python dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Update the Ollama model** (optional)
   - Edit `app.py` line 149 to change the model name if needed
   - Default is set to 'llama3.2'

4. **Run the application**
   ```bash
   python app.py
   ```

5. **Access the app**
   - Open your browser to `http://localhost:5000`
   - Register a new account or login

## Usage

### Authentication
- Navigate to `/register` to create a new account
- Use `/login` to sign in
- Logout using the logout button in the top navigation

### Todo Management
- Switch to the "Todos" tab in the left panel
- Type a todo item and press Enter or click the + button
- Check/uncheck todos to mark them as complete
- Click the × button to delete a todo

### Note Taking
- Switch to the "Notes" tab in the left panel
- Click "+ New Note" to create a new note
- Click on any existing note to edit it
- Right-click on a note to delete it
- Use Ctrl/Cmd + N to quickly create a new note
- Use Ctrl/Cmd + Enter to save a note

### AI Chat
- Type messages in the chat input area on the right
- Press Enter or click "Send" to send messages
- The AI will respond using your configured Ollama model
- Click "Clear" to clear the chat history

### Theme Switching
- Click the moon/sun icon in the top right to toggle between light and dark modes
- Your preference is saved automatically

## Configuration

### Ollama Setup
Make sure Ollama is running and accessible at `http://localhost:11434`. You can test this by running:
```bash
curl http://localhost:11434/api/generate -d '{"model":"llama3.2","prompt":"Hello","stream":false}'
```

### Changing the AI Model
Edit the model name in `app.py` around line 149:
```python
'model': 'your-preferred-model',  # Change this to your model
```

### Security
- Change the secret key in `app.py` line 8 for production use
- The database file `database.db` will be created automatically

## File Structure

```
todo-ai-app/
├── app.py                 # Main Flask application
├── requirements.txt       # Python dependencies
├── README.md             # This file
├── database.db           # SQLite database (created automatically)
├── templates/
│   ├── index.html        # Main application page
│   ├── login.html        # Login page
│   └── register.html     # Registration page
└── static/
    ├── css/
    │   └── style.css     # All styles with theme support
    └── js/
        └── app.js        # Frontend JavaScript functionality
```

## API Endpoints

### Authentication
- `POST /login` - User login
- `POST /register` - User registration
- `GET /logout` - User logout

### Todos
- `GET /api/todos` - Get all todos for logged-in user
- `POST /api/todos` - Create a new todo
- `PUT /api/todos/<id>` - Update todo (mark complete/incomplete)
- `DELETE /api/todos/<id>` - Delete a todo

### Notes
- `GET /api/notes` - Get all notes for logged-in user
- `POST /api/notes` - Create a new note
- `PUT /api/notes/<id>` - Update a note
- `DELETE /api/notes/<id>` - Delete a note

### Chat
- `POST /api/chat` - Send message to AI and get response
- `GET /api/chat/history` - Get recent chat history

## Troubleshooting

1. **AI not responding**: Make sure Ollama is running and the model is available
2. **Database errors**: Delete `database.db` and restart the app to recreate the database
3. **Port conflicts**: Change the port in `app.py` if port 5000 is in use
4. **Theme not saving**: Check browser localStorage permissions

## Development

The app uses:
- **Flask** for the backend API and routing
- **SQLite** for data persistence
- **Vanilla JavaScript** for frontend interactivity
- **CSS Custom Properties** for theming
- **Ollama API** for AI functionality

Feel free to modify and extend the application as needed!
