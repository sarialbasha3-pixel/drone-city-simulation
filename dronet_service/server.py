from __future__ import annotations

import base64
import io
import os
import time
from typing import List, Optional

import numpy as np
import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image

from dronet_model import load_dronet_model, DronetV3

app = FastAPI(title="PULP-DroNet v3 Obstacle Avoidance Inference Bridge", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
WEIGHTS_PATH = os.path.join(os.path.dirname(__file__), "weights", "pulp-dronet-v3-resblock-1.0.pth")

print(f"[PULP-DroNet Server] Initializing model on device: {DEVICE}...")
model: DronetV3 = load_dronet_model(WEIGHTS_PATH, device=DEVICE)


class DroNetInferRequest(BaseModel):
    image_base64: Optional[str] = None
    pixels_flat: Optional[List[float]] = None  # 40000 length (200x200)
    image_grid: Optional[List[List[float]]] = None  # 200x200


@app.get("/health")
@app.get("/dronet/health")
def health():
    return {
        "ok": True,
        "model": "PULP-DroNet v3 (ResBlock-1.0)",
        "device": DEVICE,
        "input_shape": [1, 1, 200, 200],
        "weights_loaded": os.path.exists(WEIGHTS_PATH),
        "outputs": ["steering_angle", "collision_probability"]
    }


@app.post("/infer")
@app.post("/dronet/infer")
def infer(req: DroNetInferRequest):
    t0 = time.perf_counter()
    tensor_img = None

    try:
        if req.image_base64:
            # Decode base64 image data
            img_data = req.image_base64
            if "," in img_data:
                img_data = img_data.split(",", 1)[1]
            raw_bytes = base64.b64decode(img_data)
            img = Image.open(io.BytesIO(raw_bytes)).convert("L")
            if img.size != (200, 200):
                img = img.resize((200, 200), Image.BILINEAR)
            arr = np.array(img, dtype=np.float32) / 255.0
            tensor_img = torch.from_numpy(arr).unsqueeze(0).unsqueeze(0).to(DEVICE)

        elif req.pixels_flat is not None and len(req.pixels_flat) == 40000:
            arr = np.array(req.pixels_flat, dtype=np.float32).reshape((1, 1, 200, 200))
            tensor_img = torch.from_numpy(arr).to(DEVICE)

        elif req.image_grid is not None and len(req.image_grid) == 200:
            arr = np.array(req.image_grid, dtype=np.float32).reshape((1, 1, 200, 200))
            tensor_img = torch.from_numpy(arr).to(DEVICE)

        else:
            # Fallback zero/center tensor
            tensor_img = torch.zeros((1, 1, 200, 200), dtype=torch.float32, device=DEVICE)

        with torch.no_grad():
            steer, coll = model(tensor_img)
            steering_val = float(steer.squeeze().item())
            coll_val = float(coll.squeeze().item())

        elapsed_ms = (time.perf_counter() - t0) * 1000.0

        return {
            "status": "ok",
            "steering": steering_val,
            "collision_prob": coll_val,
            "inference_time_ms": round(elapsed_ms, 2)
        }

    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8766)
