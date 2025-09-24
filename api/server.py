# api/server.py
"""
FastAPI wrapper to securely proxy image inference requests (roboflow or other)
Place your Roboflow API key in environment variable: ROBOFLOW_API_KEY
Place your Roboflow model endpoint URL in: ROBOFLOW_MODEL_URL
"""

import os
import io
import logging
from typing import List, Dict
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx
from pydantic import BaseModel
from PIL import Image

app = FastAPI(title="Cattle Classifier Proxy", version="0.1")

# Allow only your frontend domain(s) here.
FRONTEND_ORIGINS = os.getenv("FRONTEND_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)

# Minimal breed info DB. Expand as needed or put into Postgres/Supabase.
BREED_INFO = {
    "Murrah": {
        "advantages": ["High milk yield", "Good adaptability to hot climates"],
        "disadvantages": ["High feed requirements", "Not ideal for cold climates"]
    },
    "Gir": {
        "advantages": ["High butterfat", "Hardy and parasite-resistant"],
        "disadvantages": ["Lower total yield than Murrah"]
    },
    "Sahiwal": {
        "advantages": ["Heat tolerant", "Good milk quality"],
        "disadvantages": ["Moderate yield compared to specialized breeds"]
    },
    "Buffalo": {
        "advantages": ["High fat content in milk", "Good draught potential"],
        "disadvantages": ["Slower growth rate", "Requires plentiful water"]
    }
}

ROBOFLOW_API_KEY = os.getenv("ROBOFLOW_API_KEY")
ROBOFLOW_MODEL_URL = os.getenv("ROBOFLOW_MODEL_URL")  # e.g. https://detect.roboflow.com/{workspace}/{model}/{version}?api_key=...

if not ROBOFLOW_MODEL_URL:
    logging.warning("ROBOFLOW_MODEL_URL not set. You must configure it in environment variables.")

# Simple response model
class TopKItem(BaseModel):
    breed: str
    confidence: float

class PredictResponse(BaseModel):
    breed: str
    confidence: float
    advantages: List[str] = []
    disadvantages: List[str] = []
    top_k: List[TopKItem] = []
    advice: str = ""

def validate_image(contents: bytes) -> None:
    try:
        img = Image.open(io.BytesIO(contents))
        img.verify()
    except Exception as e:
        raise HTTPException(status_code=400, detail="Uploaded file is not a valid image.")

@app.post("/predict", response_model=PredictResponse)
async def predict(file: UploadFile = File(...)):
    # Basic security validations:
    if file.content_type.split("/")[0] != "image":
        raise HTTPException(status_code=400, detail="Upload must be an image.")
    contents = await file.read()
    if len(contents) > (8 * 1024 * 1024):  # 8 MB limit
        raise HTTPException(status_code=400, detail="Image too large (max 8MB).")
    validate_image(contents)

    # If you have a Roboflow model endpoint, proxy to it:
    if ROBOFLOW_MODEL_URL and ROBOFLOW_API_KEY:
        # Roboflow expects form-data with 'file' and api key included in URL query param in many setups.
        # Here we call the model endpoint using httpx (server-side).
        async with httpx.AsyncClient(timeout=30.0) as client:
            files = {"file": ("upload.jpg", contents, file.content_type)}
            # If your ROBOFLOW_MODEL_URL already contains the api_key param, you can call directly
            url = ROBOFLOW_MODEL_URL
            try:
                resp = await client.post(url, files=files, headers={"User-Agent": "Cattle-Proxy/1.0"})
            except Exception as e:
                raise HTTPException(status_code=502, detail="Error contacting inference service.")
            if resp.status_code != 200:
                raise HTTPException(status_code=502, detail=f"Inference failed: {resp.status_code}")
            data = resp.json()
            # Roboflow detection response shape can differ; try to map to top_k.
            # Expected: data["predictions"] = [{ "class": "Murrah", "confidence": 0.8 }, ...]
            preds = []
            if isinstance(data, dict) and "predictions" in data:
                for p in data["predictions"]:
                    preds.append({"breed": p.get("class") or p.get("label") or "Unknown",
                                  "confidence": float(p.get("confidence", 0.0))})
            else:
                # Fallback — try to interpret common fields
                # If your model returns a single label, adapt here.
                if "label" in data and "confidence" in data:
                    preds.append({"breed": data["label"], "confidence": float(data["confidence"])})
            if not preds:
                raise HTTPException(status_code=502, detail="No predictions returned by model.")

            # Sort preds by confidence desc
            preds.sort(key=lambda x: x["confidence"], reverse=True)
            top = preds[0]
            breed = top["breed"]
            conf = top["confidence"]

            # Lookup breed info
            info = BREED_INFO.get(breed, {"advantages": [], "disadvantages": []})

            advice = ""
            if conf < 0.6:
                advice = "Low confidence — try a clearer, side-view image in good lighting."
            else:
                advice = "Confidence high. For better accuracy, upload a side-view photo."

            # Build top_k
            top_k = [{"breed": p["breed"], "confidence": p["confidence"]} for p in preds[:5]]

            return {
                "breed": breed,
                "confidence": conf,
                "advantages": info.get("advantages", []),
                "disadvantages": info.get("disadvantages", []),
                "top_k": top_k,
                "advice": advice
            }

    # If no remote inference configured, return helpful error
    raise HTTPException(status_code=500, detail="No inference backend configured (ROBOFLOW_* env vars missing).")
