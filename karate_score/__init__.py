import os

from werkzeug.datastructures import ImmutableMultiDict

from karate_score.Application import Application
from flask import Flask, request, render_template, make_response, session, send_file, redirect, jsonify, flash, abort
from flask_socketio import SocketIO
import toml


socketio = SocketIO()


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

    application = Application(app.config, socketio)

    # ensure the instance folder exists
    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass

    @app.route('/')
    def homepage():
        return render_template('index.html', config=app.config)


    return app


def main():
    app = create_app()  # put in here the config-file
    socketio.run(app, host="localhost", port=5000, debug=True)
