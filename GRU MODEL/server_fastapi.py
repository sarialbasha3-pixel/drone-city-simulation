from __future__ import annotations

from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from model_runtime import GRUV3Runtime, FEATURE_ORDER

app = FastAPI(title="Project Ghost GRU V3 Inference Bridge", version="1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Local simulation development. Restrict origins before deployment.
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

runtime = GRUV3Runtime()


class InferenceRequest(BaseModel):
    features: List[List[float]]
    eskf_velocity_m_s: Optional[List[float]] = None


@app.get("/health")
def health():
    return {
        "ok": True,
        "model": "Project Ghost GRU V3",
        "input_shape": [101, 24],
        "feature_order": FEATURE_ORDER,
        "output": "delta_v_m_s",
    }


@app.post("/infer")
def infer(req: InferenceRequest):
    try:
        return runtime.infer(req.features, req.eskf_velocity_m_s)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
