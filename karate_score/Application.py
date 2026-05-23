import random


class Application:

    def __init__(self, config, socketio):
        self.config = config
        self.socketio = socketio

        if not self.config.get('TESTING'):
            self.socketio.start_background_task(self.publish_scores)

    def publish_scores(self) -> None:
        while True:
            self.socketio.emit(
                'competition/1',
                {
                    'oponent_a': random.randint(0, 9),
                    'oponent_b': random.randint(0, 9),
                },
            )
            self.socketio.sleep(1)
