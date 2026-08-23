import sys
import json
import datetime
from data_loader import fetch_user_data
from feature_engineering import generate_prediction_features
from model_manager import load_model
from cycle_builder import build_cycles

def predict_next(user_id):
    data = fetch_user_data(user_id)
    if not data:
        return {"success": False, "reason": "User not found"}
        
    cycles, ongoing = build_cycles(data['period_days'])
    
    pipeline, metadata = load_model()
    
    # Baseline approach calculation
    hist_lengths = [c['cycle_length'] for c in cycles]
    baseline_pred = sum(hist_lengths) / len(hist_lengths) if hist_lengths else data['profile'].get('avg_cycle_length', 28)
    baseline_pred = float(baseline_pred)
    
    if not ongoing:
        return {"success": False, "reason": "No ongoing period to base prediction upon."}
        
    start_date = ongoing['period_start']
    
    if not pipeline or not metadata or not metadata.get("improvement"):
        next_date = start_date + datetime.timedelta(days=int(round(baseline_pred)))
        return {
            "predicted_cycle_length": baseline_pred,
            "predicted_period_date": next_date.isoformat(),
            "model_available": False,
            "prediction_method": "baseline"
        }
        
    X_predict = generate_prediction_features(data)
    if X_predict is None:
        next_date = start_date + datetime.timedelta(days=int(round(baseline_pred)))
        return {
            "predicted_cycle_length": baseline_pred,
            "predicted_period_date": next_date.isoformat(),
            "model_available": False,
            "prediction_method": "baseline"
        }
        
    y_pred = pipeline.predict(X_predict)[0]
    next_date = start_date + datetime.timedelta(days=int(round(y_pred)))
    
    return {
        "predicted_cycle_length": float(y_pred),
        "predicted_period_date": next_date.isoformat(),
        "model_available": True,
        "prediction_method": "random_forest"
    }

if __name__ == '__main__':
    uid = sys.argv[1]
    res = predict_next(uid)
    print(json.dumps(res))
