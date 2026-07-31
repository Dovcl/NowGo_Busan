from fastapi import APIRouter
from routers.health import router as health_router
from routers.places import router as places_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(places_router, prefix="/api")