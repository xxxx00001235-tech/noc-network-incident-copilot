from fastapi import FastAPI

from app.api.alarm import router as alarm_router


app = FastAPI(title="NOC Backend")
app.include_router(alarm_router)


@app.get("/")
def root() -> dict[str, str]:
    return {"status": "ok", "service": "noc-backend"}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "healthy"}
