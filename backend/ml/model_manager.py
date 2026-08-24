import os
import joblib

MODEL_DIR = os.path.join(os.path.dirname(__file__), 'artifacts')
if not os.path.exists(MODEL_DIR):
    os.makedirs(MODEL_DIR)

MODEL_PATH = os.path.join(MODEL_DIR, 'model_pipeline.pkl')
META_PATH = os.path.join(MODEL_DIR, 'metadata.json')

def save_model(pipeline, metadata):
    import json
    joblib.dump(pipeline, MODEL_PATH)
    with open(META_PATH, 'w') as f:
        json.dump(metadata, f)

def load_model():
    import json
    if not os.path.exists(MODEL_PATH):
        return None, None
    pipeline = joblib.load(MODEL_PATH)
    with open(META_PATH, 'r') as f:
        metadata = json.load(f)
    return pipeline, metadata
