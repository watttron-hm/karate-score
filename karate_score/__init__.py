import json
import os
from datetime import timedelta
from hmac import compare_digest

from karate_score.Application import Application
from flask import Flask, jsonify, request, render_template, session, redirect, url_for
from flask_socketio import SocketIO
import toml


socketio = SocketIO()
AUTH_SESSION_KEY = 'scoreboard_authenticated'


def create_app(test_config=None):
    # create and configure the app
    app = Flask(__name__, instance_relative_config=True, instance_path=os.path.join(os.getcwd(), 'instance'))
    socketio.init_app(app)

    app.config.from_mapping(
        SECRET_KEY='dev',
        HOST='http://localhost',
    )

    if test_config is None:
        # load the instance config, if it exists, when not testing
        app.config.from_file('application.toml', silent=False, load=toml.load)
    else:
        # load the test config if passed in
        app.config.from_mapping(test_config)

    app.permanent_session_lifetime = timedelta(days=36500)

    application = Application(app.config, socketio)
    current_score = None

    # ensure the instance folder exists
    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass

    @app.route('/')
    def homepage():
        return render_template('index.html', current_score=current_score)

    @app.route('/login', methods=['GET', 'POST'])
    def login():
        if session.get(AUTH_SESSION_KEY):
            return redirect(url_for('scoreboard'))

        error = None
        if request.method == 'POST':
            password = request.form.get('password', '')
            admin_password = app.config.get('ADMIN_PASSWORD', '')

            if admin_password and compare_digest(password, admin_password):
                session.permanent = True
                session[AUTH_SESSION_KEY] = True
                return redirect(url_for('scoreboard'))

            error = 'Invalid password.'

        return render_template('login.html', error=error)

    @app.route('/logout')
    def logout():
        session.pop(AUTH_SESSION_KEY, None)
        return redirect(url_for('login'))

    @app.route('/scoreboard')
    def scoreboard():
        if not session.get(AUTH_SESSION_KEY):
            return redirect(url_for('login'))

        return render_template('scoreboard.html', config=app.config)

    @app.route('/update_score', methods=['POST'])
    def update_score():
        nonlocal current_score

        if not session.get(AUTH_SESSION_KEY):
            return jsonify({'error': 'login_required'}), 401

        state = request.get_json()
        current_score = state
        print("state", state)

        if app.config.get('GAME_STORE_PATH'):
            with open(os.path.join(app.config.get('GAME_STORE_PATH'), "scoreboard.json"), "w") as f:
                json.dump(state, f)

        socketio.emit('scoreboard', state)

        return jsonify({'status': 'ok'})


    return app


def main():
    app = create_app()  # put in here the config-file
    socketio.run(app, host="localhost", port=5000, debug=True)
