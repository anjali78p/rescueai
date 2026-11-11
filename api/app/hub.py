import asyncio


class Hub:
    """In-process pub/sub for Server-Sent Events. Single-instance only; use Redis pub/sub to scale out."""

    def __init__(self) -> None:
        self.subs: set[asyncio.Queue] = set()

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=200)
        self.subs.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self.subs.discard(q)

    def publish(self, event: dict) -> None:
        for q in list(self.subs):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                pass
