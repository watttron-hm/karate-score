import os
import pytest as pytest
from karate_score import create_app

default_config = {
    'TESTING': True,
    'HOST': 'http://localhost',
    'STATIC_FOLDER': os.path.join(os.getcwd(), 'manual_generator', 'static'),
    'ADMIN_PASSWORD': 'test-password',
}


@pytest.fixture
def app():
    app = create_app(default_config)
    yield app


@pytest.fixture
def client(app):
    return app.test_client()
