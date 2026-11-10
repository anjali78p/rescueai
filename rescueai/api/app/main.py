import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routes import router
from .seed import seed_defaults, seed_demo_users
from .state import get_store

log = logging.getLogger("rescueai")


@asynccontextmanager
async def lifespan(app: FastAPI):
    store = get_store()
    seed_defaults(store)
    if settings.demo_mode:
        seed_demo_users(store)
        log.warning("DEMO_MODE is on: demo accounts exist. Turn it off in production.")
    if settings.jwt_secret_is_ephemeral:
        log.warning("JWT_SECRET not set: using a random secret, sessions reset on restart.")
    yield


app = FastAPI(title="RescueAI API", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=False,
                   allow_methods=["*"], allow_headers=["*"])
app.include_router(router)
