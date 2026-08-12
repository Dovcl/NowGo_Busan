from fastapi import APIRouter
from routers.auth import router as auth_router
from routers.environment import router as environment_router
from routers.health import router as health_router
from routers.places import router as places_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(places_router, prefix="/api")
api_router.include_router(environment_router, prefix="/api")
api_router.include_router(auth_router)