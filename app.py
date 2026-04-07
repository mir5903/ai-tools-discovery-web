import json
import os
from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify
from datetime import datetime
from urllib.parse import urlparse
from whitenoise import WhiteNoise

app = Flask(__name__)
app.secret_key = 'your_super_secret_key_change_this_asap'

app.wsgi_app = WhiteNoise(app.wsgi_app, root=os.path.join(os.path.dirname(__file__), 'static'), prefix='static/')

# Get the database URL from Render's environment variables
DATABASE_URL = os.environ.get('DATABASE_URL')

# --- Helper Functions for JSON DB ---

def read_json(file_path):
    """Reads data from a JSON file."""
    if not os.path.exists(file_path):
        if file_path == USERS_FILE:
            return {}
        elif file_path == TOOLS_FILE:
            return []
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except json.JSONDecodeError:
        return {} if file_path == USERS_FILE else []

def write_json(file_path, data):
    """Writes data to a JSON file."""
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4)

# ** 1. USE RELATIVE PATHS **
# File paths for our JSON "databases"
USERS_FILE = 'users.json'  
TOOLS_FILE = 'tools.json'

@app.route('/')
def home():
    """Renders the homepage"""
    search_query = request.args.get('search', '').lower()
    all_tools = read_json(TOOLS_FILE)
    
    all_tools_sorted = sorted(all_tools, key=lambda x: x['upvotes'], reverse=True)
    
    heading = "" 
    
    if search_query:
        display_tools = [
            tool for tool in all_tools_sorted
            if search_query in tool['name'].lower() or \
               search_query in tool['description'].lower() or \
               search_query in tool['category'].lower()
        ]
        heading = f"Found {len(display_tools)} results for \"{search_query}\""
    else:
        # ** THIS IS THE FIX: Changed to all_tools_sorted[:3] **
        display_tools = all_tools_sorted[:3]
        heading = "Today's Top 3 AI Tools"
    
    all_tools_json = json.dumps(all_tools)
    
    return render_template(
        'index.html', 
        tools=display_tools,
        search_query=search_query,
        all_tools_json=all_tools_json,
        heading=heading
    )

# ** NEW: AI Detail Page Route **
@app.route('/ai/<int:tool_id>')
def ai_detail(tool_id):
    """Renders the dedicated page for a single AI tool."""
    all_tools = read_json(TOOLS_FILE)
    tool = next((t for t in all_tools if t['id'] == tool_id), None)
    
    if tool is None:
        flash('AI tool not found.', 'error')
        return redirect(url_for('home'))
        
    return render_template('ai_detail.html', tool=tool)

# ** NEW: Add Review Route **
@app.route('/ai/<int:tool_id>/review', methods=['POST'])
def add_review(tool_id):
    """Handles the submission of a new review."""
    if 'username' not in session:
        flash('You must be logged in to submit a review.', 'error')
        return redirect(url_for('ai_detail', tool_id=tool_id))
        
    all_tools = read_json(TOOLS_FILE)
    tool = next((t for t in all_tools if t['id'] == tool_id), None)

    if tool:
        new_review = {
            "username": session['username'],
            "rating": int(request.form['rating']),
            "comment": request.form['comment'],
            "date": datetime.now().strftime('%m/%d/%Y')
        }
        
        # Initialize reviews list if it doesn't exist
        if 'reviews' not in tool:
            tool['reviews'] = []
            
        tool['reviews'].append(new_review)
        write_json(TOOLS_FILE, all_tools)
        flash('Your review has been submitted!', 'success')
        
    return redirect(url_for('ai_detail', tool_id=tool_id))


@app.route('/news')
def news():
    """Renders the new News page."""
    return render_template('news.html')

@app.route('/tournament')
def tournament():
    """Renders the new Tournament page."""
    return render_template('tournament.html')

@app.route('/submit', methods=['GET', 'POST'])
def submit_page():
    """Handles the "Submit AI" page."""
    if 'username' not in session:
        flash('You must be logged in to submit an AI tool.', 'error')
        return redirect(url_for('login'))

    if request.method == 'POST':
        tools = read_json(TOOLS_FILE)
        
        # ** START: UPDATED DOMAIN LOGIC **
        url_string = request.form['ai-url']
        if not url_string.startswith(('http://', 'https://')):
            url_string = 'https://' + url_string
        
        netloc = urlparse(url_string).netloc
        parts = netloc.split('.')
        
        # Get the base domain (e.g., google.com from www.google.com or gemini.google.com)
        if len(parts) > 2:
            # This handles subdomains and 'www'
            domain = f"{parts[-2]}.{parts[-1]}"
        else:
            # This handles base domains (e.g., perplexity.ai)
            domain = netloc
        # ** END: UPDATED DOMAIN LOGIC **

        new_tool = {
            "id": len(tools) + 1,
            "name": request.form['ai-name'],
            "description": request.form['ai-description'],
            "long_description": request.form.get('ai-long-description', request.form['ai-description']),
            "category": request.form['ai-category'],
            "url": url_string, 
            
            # Use the new, smarter 'domain' variable
            "logo_url": f"https://logo.clearbit.com/{domain}", 
            
            "ceo_team": [name.strip() for name in request.form.get('ai-team', '').split(',')],
            "pricing": request.form.get('ai-pricing', 'Free'),
            "upvotes": 0,
            "voted_by": [],
            "reviews": []
        }
        
        tools.append(new_tool)
        write_json(TOOLS_FILE, tools)
        
        flash('Your AI tool has been submitted successfully!', 'success')
        return redirect(url_for('home'))

    return render_template('submit.html')

# --- Authentication Routes ---

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    """Handles user registration with email and password validation."""
    if request.method == 'POST':
        users = read_json(USERS_FILE)
        email = request.form['email']
        username = request.form['username']
        password = request.form['password']
        confirm_password = request.form['confirm_password']

        if password != confirm_password:
            flash('Passwords do not match. Please try again.', 'error')
            return render_template('signup.html', email=email, username=username)
        
        if username in users:
            flash('Username already exists. Please choose another.', 'error')
            return render_template('signup.html', email=email, username=username)

        for user_data in users.values():
            if user_data['email'] == email:
                flash('Email is already registered. Please log in or use a different email.', 'error')
                return render_template('signup.html', email=email, username=username)

        users[username] = {
            'email': email,
            'password': password
        }
        write_json(USERS_FILE, users)
        
        flash('Account created successfully! Please log in.', 'success')
        return redirect(url_for('login'))

    return render_template('signup.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    """Handles user login."""
    if request.method == 'POST':
        users = read_json(USERS_FILE)
        username = request.form['username']
        password = request.form['password']

        if username not in users or users[username]['password'] != password:
            flash('Invalid username or password.', 'error')
        else:
            session['username'] = username
            flash('Logged in successfully!', 'success')
            return redirect(url_for('home'))

    return render_template('login.html')

@app.route('/logout')
def logout():
    """Handles user logout."""
    session.pop('username', None)
    flash('You have been logged out.', 'success')
    return redirect(url_for('home'))

@app.route('/forgot_password', methods=['GET', 'POST'])
def forgot_password():
    """Handles the 'Forgot Password' flow."""
    if request.method == 'POST':
        users = read_json(USERS_FILE)
        identifier = request.form['identifier']
        
        found_user = None
        
        if identifier in users:
            found_user = { 'username': identifier, **users[identifier] }
        else:
            for username, data in users.items():
                if data['email'] == identifier:
                    found_user = { 'username': username, **data }
                    break
        
        if found_user:
            return render_template('show_details.html', user=found_user)
        else:
            flash('No account found with that email or username.', 'error')
            
    return render_template('forgot.html')

# --- API Routes (for JavaScript) ---

@app.route('/vote/<int:tool_id>', methods=['POST'])
def vote(tool_id):
    """API endpoint for voting."""
    if 'username' not in session:
        return jsonify({'error': 'You must be logged in to vote.'}), 401
        
    username = session['username']
    tools = read_json(TOOLS_FILE)
    
    tool_to_vote = None
    for tool in tools:
        if tool['id'] == tool_id:
            tool_to_vote = tool
            break
            
    if not tool_to_vote:
        return jsonify({'error': 'Tool not found.'}), 404
        
    if username in tool_to_vote['voted_by']:
        tool_to_vote['upvotes'] -= 1
        tool_to_vote['voted_by'].remove(username)
        voted = False
    else:
        tool_to_vote['upvotes'] += 1
        tool_to_vote['voted_by'].append(username)
        voted = True
        
    write_json(TOOLS_FILE, tools)
    
    return jsonify({
        'success': True, 
        'new_count': tool_to_vote['upvotes'], 
        'voted': voted
    })

# --- Run the App (local development) ---
if __name__ == "__main__":
    app.run(debug=True)
