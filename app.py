from flask import Flask, render_template, request, jsonify, redirect, url_for, session, flash
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3
import json
import requests
from datetime import datetime
import os

app = Flask(__name__)
app.secret_key = 'your-secret-key-change-this'

# Database setup
def init_db():
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    
    # Roles table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS roles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            description TEXT
        )
    ''')
    
    # Insert default roles
    cursor.execute('INSERT OR IGNORE INTO roles (name, description) VALUES (?, ?)', 
                  ('admin', 'NoteBuddy Administrator with full system access'))
    cursor.execute('INSERT OR IGNORE INTO roles (name, description) VALUES (?, ?)', 
                  ('user', 'NoteBuddy user with standard access'))
    
    # Check if users table exists and get its schema
    table_info = cursor.execute("PRAGMA table_info(users)").fetchall()
    has_role_id = any(column[1] == 'role_id' for column in table_info)
    
    if not table_info:
        # Users table doesn't exist, create it with role_id
        cursor.execute('''
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role_id INTEGER DEFAULT 2,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (role_id) REFERENCES roles (id)
            )
        ''')
    elif not has_role_id:
        # Users table exists but doesn't have role_id, add it
        cursor.execute('ALTER TABLE users ADD COLUMN role_id INTEGER DEFAULT 2')
        
        # Update existing users to have the default user role (role_id = 2)
        cursor.execute('UPDATE users SET role_id = 2 WHERE role_id IS NULL')
    
    # Create admin user if not exists
    admin_exists = cursor.execute('SELECT id FROM users WHERE username = ?', ('admin',)).fetchone()
    if not admin_exists:
        admin_password_hash = generate_password_hash('admin123')
        cursor.execute('INSERT INTO users (username, email, password_hash, role_id) VALUES (?, ?, ?, ?)',
                      ('admin', 'admin@notebuddy.com', admin_password_hash, 1))
    
    # Todos table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS todos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            completed BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # Notes table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            content TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # Chat messages table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            message TEXT NOT NULL,
            response TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # Conversations table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            messages TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    conn.commit()
    conn.close()

def get_db_connection():
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    return conn

# Helper functions
def is_admin():
    if 'user_id' not in session:
        return False
    
    conn = get_db_connection()
    user = conn.execute('''
        SELECT u.*, r.name as role_name 
        FROM users u 
        JOIN roles r ON u.role_id = r.id 
        WHERE u.id = ?
    ''', (session['user_id'],)).fetchone()
    conn.close()
    
    return user and user['role_name'] == 'admin'

# Authentication routes
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        
        conn = get_db_connection()
        user = conn.execute('''
            SELECT u.*, r.name as role_name 
            FROM users u 
            JOIN roles r ON u.role_id = r.id 
            WHERE u.username = ?
        ''', (username,)).fetchone()
        conn.close()
        
        if user and check_password_hash(user['password_hash'], password):
            session['user_id'] = user['id']
            session['username'] = user['username']
            session['user_role'] = user['role_name']
            
            # Redirect admin to admin dashboard
            if user['role_name'] == 'admin':
                return redirect(url_for('admin_dashboard'))
            else:
                return redirect(url_for('index'))
        else:
            flash('Invalid username or password')
    
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        email = request.form['email']
        password = request.form['password']
        
        if len(password) < 6:
            flash('Password must be at least 6 characters long')
            return render_template('register.html')
        
        password_hash = generate_password_hash(password)
        
        conn = get_db_connection()
        try:
            conn.execute('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
                        (username, email, password_hash))
            conn.commit()
            conn.close()
            flash('Registration successful! Please log in.')
            return redirect(url_for('login'))
        except sqlite3.IntegrityError:
            flash('Username or email already exists')
            conn.close()
    
    return render_template('register.html')

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

# Main application routes
@app.route('/')
def index():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    return render_template('index.html')

# Admin routes
@app.route('/admin')
def admin_dashboard():
    if not is_admin():
        flash('Access denied. Admin privileges required.')
        return redirect(url_for('index'))
    return render_template('admin.html')

# Admin API routes
@app.route('/api/admin/users', methods=['GET'])
def get_all_users():
    if not is_admin():
        return jsonify({'error': 'Access denied'}), 403
    
    conn = get_db_connection()
    users = conn.execute('''
        SELECT u.id, u.username, u.email, u.created_at, r.name as role_name, r.id as role_id
        FROM users u 
        JOIN roles r ON u.role_id = r.id 
        ORDER BY u.created_at DESC
    ''').fetchall()
    conn.close()
    
    return jsonify([dict(user) for user in users])

@app.route('/api/admin/users/<int:user_id>/role', methods=['PUT'])
def update_user_role(user_id):
    if not is_admin():
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json()
    role_id = data.get('role_id')
    
    if not role_id:
        return jsonify({'error': 'Role ID is required'}), 400
    
    conn = get_db_connection()
    conn.execute('UPDATE users SET role_id = ? WHERE id = ?', (role_id, user_id))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True})

@app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    if not is_admin():
        return jsonify({'error': 'Access denied'}), 403
    
    # Prevent deleting the admin user
    if user_id == session['user_id']:
        return jsonify({'error': 'Cannot delete your own account'}), 400
    
    conn = get_db_connection()
    # Delete user's data
    conn.execute('DELETE FROM todos WHERE user_id = ?', (user_id,))
    conn.execute('DELETE FROM notes WHERE user_id = ?', (user_id,))
    conn.execute('DELETE FROM chat_messages WHERE user_id = ?', (user_id,))
    conn.execute('DELETE FROM conversations WHERE user_id = ?', (user_id,))
    conn.execute('DELETE FROM users WHERE id = ?', (user_id,))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True})

@app.route('/api/admin/roles', methods=['GET'])
def get_all_roles():
    if not is_admin():
        return jsonify({'error': 'Access denied'}), 403
    
    conn = get_db_connection()
    roles = conn.execute('SELECT * FROM roles ORDER BY id').fetchall()
    conn.close()
    
    return jsonify([dict(role) for role in roles])

@app.route('/api/admin/stats', methods=['GET'])
def get_admin_stats():
    if not is_admin():
        return jsonify({'error': 'Access denied'}), 403
    
    conn = get_db_connection()
    
    # Get user count
    user_count = conn.execute('SELECT COUNT(*) as count FROM users').fetchone()['count']
    
    # Get todos count
    todos_count = conn.execute('SELECT COUNT(*) as count FROM todos').fetchone()['count']
    
    # Get notes count
    notes_count = conn.execute('SELECT COUNT(*) as count FROM notes').fetchone()['count']
    
    # Get conversations count
    conversations_count = conn.execute('SELECT COUNT(*) as count FROM conversations').fetchone()['count']
    
    conn.close()
    
    return jsonify({
        'users': user_count,
        'todos': todos_count,
        'notes': notes_count,
        'conversations': conversations_count
    })

# Todo API routes
@app.route('/api/todos', methods=['GET'])
def get_todos():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    conn = get_db_connection()
    todos = conn.execute('SELECT * FROM todos WHERE user_id = ? ORDER BY created_at DESC', 
                        (session['user_id'],)).fetchall()
    conn.close()
    
    return jsonify([dict(todo) for todo in todos])

@app.route('/api/todos', methods=['POST'])
def add_todo():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    data = request.get_json()
    title = data.get('title')
    
    if not title:
        return jsonify({'error': 'Title is required'}), 400
    
    conn = get_db_connection()
    cursor = conn.execute('INSERT INTO todos (user_id, title) VALUES (?, ?)',
                         (session['user_id'], title))
    todo_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return jsonify({'id': todo_id, 'title': title, 'completed': False})

@app.route('/api/todos/<int:todo_id>', methods=['PUT'])
def update_todo(todo_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    data = request.get_json()
    completed = data.get('completed')
    
    conn = get_db_connection()
    conn.execute('UPDATE todos SET completed = ? WHERE id = ? AND user_id = ?',
                (completed, todo_id, session['user_id']))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True})

@app.route('/api/todos/<int:todo_id>', methods=['DELETE'])
def delete_todo(todo_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    conn = get_db_connection()
    conn.execute('DELETE FROM todos WHERE id = ? AND user_id = ?', (todo_id, session['user_id']))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True})

# Notes API routes
@app.route('/api/notes', methods=['GET'])
def get_notes():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    conn = get_db_connection()
    notes = conn.execute('SELECT * FROM notes WHERE user_id = ? ORDER BY updated_at DESC', 
                        (session['user_id'],)).fetchall()
    conn.close()
    
    return jsonify([dict(note) for note in notes])

@app.route('/api/notes', methods=['POST'])
def add_note():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    data = request.get_json()
    title = data.get('title')
    content = data.get('content', '')
    
    if not title:
        return jsonify({'error': 'Title is required'}), 400
    
    conn = get_db_connection()
    cursor = conn.execute('INSERT INTO notes (user_id, title, content) VALUES (?, ?, ?)',
                         (session['user_id'], title, content))
    note_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return jsonify({'id': note_id, 'title': title, 'content': content})

@app.route('/api/notes/<int:note_id>', methods=['PUT'])
def update_note(note_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    data = request.get_json()
    title = data.get('title')
    content = data.get('content')
    
    conn = get_db_connection()
    conn.execute('UPDATE notes SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
                (title, content, note_id, session['user_id']))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True})

@app.route('/api/notes/<int:note_id>', methods=['DELETE'])
def delete_note(note_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    conn = get_db_connection()
    conn.execute('DELETE FROM notes WHERE id = ? AND user_id = ?', (note_id, session['user_id']))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True})

# Chat API routes
@app.route('/api/chat', methods=['POST'])
def chat():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    data = request.get_json()
    message = data.get('message')
    
    if not message:
        return jsonify({'error': 'Message is required'}), 400
    
    try:
        # Send message to Ollama API
        ollama_response = requests.post('http://localhost:11434/api/generate', 
                                      json={
                                          'model': 'llama3.2:3b',  # Change this to your preferred model
                                          'prompt': message,
                                          'stream': False
                                      }, timeout=30)
        
        if ollama_response.status_code == 200:
            response_text = ollama_response.json().get('response', 'No response from AI')
        else:
            response_text = 'Sorry, I am currently unavailable.'
    
    except requests.exceptions.RequestException:
        response_text = 'Sorry, I am currently unavailable. Please make sure Ollama is running.'
    
    # Save chat message to database
    conn = get_db_connection()
    conn.execute('INSERT INTO chat_messages (user_id, message, response) VALUES (?, ?, ?)',
                (session['user_id'], message, response_text))
    conn.commit()
    conn.close()
    
    return jsonify({'response': response_text})

@app.route('/api/chat/history', methods=['GET'])
def get_chat_history():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    conn = get_db_connection()
    messages = conn.execute('SELECT * FROM chat_messages WHERE user_id = ? ORDER BY timestamp DESC LIMIT 50', 
                           (session['user_id'],)).fetchall()
    conn.close()
    
    return jsonify([dict(msg) for msg in messages])

# Conversation management API routes
@app.route('/api/conversations', methods=['GET'])
def get_conversations():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    conn = get_db_connection()
    conversations = conn.execute('SELECT id, title, created_at, updated_at FROM conversations WHERE user_id = ? ORDER BY updated_at DESC', 
                               (session['user_id'],)).fetchall()
    conn.close()
    
    return jsonify([dict(conv) for conv in conversations])

@app.route('/api/conversations', methods=['POST'])
def save_conversation():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    data = request.get_json()
    title = data.get('title')
    messages = data.get('messages')
    conversation_id = data.get('conversation_id')  # For updating existing conversation
    
    if not title or not messages:
        return jsonify({'error': 'Title and messages are required'}), 400
    
    conn = get_db_connection()
    
    if conversation_id:
        # Update existing conversation
        conn.execute('UPDATE conversations SET title = ?, messages = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
                    (title, json.dumps(messages), conversation_id, session['user_id']))
    else:
        # Create new conversation
        cursor = conn.execute('INSERT INTO conversations (user_id, title, messages) VALUES (?, ?, ?)',
                             (session['user_id'], title, json.dumps(messages)))
        conversation_id = cursor.lastrowid
    
    conn.commit()
    conn.close()
    
    return jsonify({'id': conversation_id, 'title': title, 'success': True})

@app.route('/api/conversations/<int:conversation_id>', methods=['GET'])
def get_conversation(conversation_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    conn = get_db_connection()
    conversation = conn.execute('SELECT * FROM conversations WHERE id = ? AND user_id = ?', 
                              (conversation_id, session['user_id'])).fetchone()
    conn.close()
    
    if not conversation:
        return jsonify({'error': 'Conversation not found'}), 404
    
    try:
        messages = json.loads(conversation['messages'])
        return jsonify({
            'id': conversation['id'],
            'title': conversation['title'],
            'messages': messages,
            'created_at': conversation['created_at'],
            'updated_at': conversation['updated_at']
        })
    except json.JSONDecodeError:
        return jsonify({'error': 'Invalid conversation data'}), 500

@app.route('/api/conversations/<int:conversation_id>', methods=['DELETE'])
def delete_conversation(conversation_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    conn = get_db_connection()
    conn.execute('DELETE FROM conversations WHERE id = ? AND user_id = ?', 
                (conversation_id, session['user_id']))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True})

# File export endpoints
@app.route('/api/notes/<int:note_id>/export/<format_type>', methods=['GET'])
def export_note(note_id, format_type):
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    conn = get_db_connection()
    note = conn.execute('SELECT * FROM notes WHERE id = ? AND user_id = ?', 
                       (note_id, session['user_id'])).fetchone()
    conn.close()
    
    if not note:
        return jsonify({'error': 'Note not found'}), 404
    
    try:
        # Parse rich text content
        content_data = json.loads(note['content']) if note['content'] else {'text': '', 'html': ''}
        
        if format_type == 'pdf':
            # For PDF export, return the text content
            return jsonify({
                'title': note['title'],
                'content': content_data.get('text', ''),
                'html': content_data.get('html', '')
            })
        elif format_type == 'html':
            # For HTML/DOCX export
            html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>{note['title']}</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }}
        h1 {{ margin-bottom: 20px; }}
    </style>
</head>
<body>
    <h1>{note['title']}</h1>
    {content_data.get('html', '')}
</body>
</html>
            """
            return html_content, 200, {'Content-Type': 'text/html'}
        
    except json.JSONDecodeError:
        # Fallback for old plain text notes
        if format_type == 'pdf':
            return jsonify({
                'title': note['title'],
                'content': note['content'] or '',
                'html': f'<p>{note["content"] or ""}</p>'
            })
        elif format_type == 'html':
            html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>{note['title']}</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }}
        h1 {{ margin-bottom: 20px; }}
    </style>
</head>
<body>
    <h1>{note['title']}</h1>
    <p>{note['content'] or ''}</p>
</body>
</html>
            """
            return html_content, 200, {'Content-Type': 'text/html'}
    
    return jsonify({'error': 'Invalid format'}), 400

if __name__ == '__main__':
    init_db()
    app.run(debug=True)
