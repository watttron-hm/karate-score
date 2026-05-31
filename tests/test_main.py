def test_scoreboard_redirects_to_login_when_logged_out(client):
    response = client.get("/scoreboard")

    assert response.status_code == 302
    assert response.headers["Location"].endswith("/login")


def test_login_sets_cookie_and_allows_scoreboard(client):
    response = client.post("/login", data={"password": "test-password"})

    assert response.status_code == 302
    assert "session=" in response.headers["Set-Cookie"]
    assert "Expires=" in response.headers["Set-Cookie"]
    assert response.headers["Location"].endswith("/scoreboard")

    scoreboard_response = client.get("/scoreboard")

    assert scoreboard_response.status_code == 200


def test_score_page_returns_200_without_login(client):
    response = client.get("/")

    assert response.status_code == 200
    assert b'displayArea' in response.data
    assert b'controls' not in response.data


def test_logout_clears_scoreboard_session(client):
    client.post("/login", data={"password": "test-password"})

    response = client.get("/logout")

    assert response.status_code == 302
    assert response.headers["Location"].endswith("/login")

    scoreboard_response = client.get("/scoreboard")

    assert scoreboard_response.status_code == 302
    assert scoreboard_response.headers["Location"].endswith("/login")


def test_update_score_redirects_to_login_when_logged_out(client):
    response = client.post("/update_score", json={"aka": {"ippon": 1}})

    assert response.status_code == 401
    assert response.json == {"error": "login_required"}


def test_update_score_publishes_state_when_logged_in(client, monkeypatch):
    emitted = {}

    def emit(topic, payload):
        emitted["topic"] = topic
        emitted["payload"] = payload

    monkeypatch.setattr("karate_score.socketio.emit", emit)
    client.post("/login", data={"password": "test-password"})

    state = {
        "aka": {"ippon": 1, "waza": 0, "penalties": [0, 0, 0]},
        "shiro": {"ippon": 0, "waza": 0, "penalties": [0, 0, 0]},
    }
    response = client.post("/update_score", json=state)

    assert response.status_code == 200
    assert response.json == {"status": "ok"}
    assert emitted == {"topic": "scoreboard", "payload": state}


def test_score_page_receives_current_score(client, monkeypatch, tmp_path, app):
    monkeypatch.setitem(app.config, "GAME_STORE_PATH", str(tmp_path))
    client.post("/login", data={"password": "test-password"})

    state = {
        "aka": {"name": "Aka Name", "ippon": 1, "waza": 0, "penalties": [0, 0, 0]},
        "shiro": {"name": "Shiro Name", "ippon": 0, "waza": 0, "penalties": [0, 0, 0]},
        "match": {"fightNumber": "12", "category": "Kumite", "nextFight": "13"},
    }
    client.post("/update_score", json=state)

    response = client.get("/")

    assert response.status_code == 200
    assert b"scoreboardInitialState" in response.data
    assert b"Aka Name" in response.data
