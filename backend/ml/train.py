import sys
import json
import warnings
from sklearn.ensemble import RandomForestRegressor
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error
import pandas as pd
import numpy as np

from data_loader import fetch_user_data
from feature_engineering import build_training_dataset
from model_manager import save_model

warnings.filterwarnings('ignore')

def train_model(user_id):
    data = fetch_user_data(user_id)
    if not data:
        return {"success": False, "reason": "User not found"}
        
    X, y = build_training_dataset(data)
    
    # 2 completed cycles produces 1 training sample. It is dangerous to train trees on < 3 samples.
    if len(X) < 3:
        return {
            "success": False, 
            "reason": "Insufficient data. Need at least 4 completed cycles.",
            "training_samples": len(X)
        }
        
    # Split chronologically (last 1 cycle for testing, rest for training)
    # This prevents temporal leakage and tests realistic prediction
    X_train = X.iloc[:-1]
    y_train = y.iloc[:-1]
    X_test = X.iloc[-1:]
    y_test = y.iloc[-1:]
    
    # Identify categoricals vs numericals
    numeric_features = ['age', 'bmi', 'previous_cycle_length', 'previous_period_length', 
                        'previous_2_cycle_length', 'previous_3_cycle_length', 
                        'rolling_average_cycle_length', 'cycle_length_std',
                        'average_sleep', 'average_water', 'average_stress', 
                        'average_pain_during_period', 'average_mood']
    categorical_features = ['exercise_frequency']
    
    preprocessor = ColumnTransformer(
        transformers=[
            ('num', StandardScaler(), numeric_features),
            ('cat', OneHotEncoder(handle_unknown='ignore'), categorical_features)
        ])
        
    pipeline = Pipeline(steps=[
        ('preprocessor', preprocessor),
        ('model', RandomForestRegressor(n_estimators=50, random_state=42, max_depth=5))
    ])
    
    pipeline.fit(X_train, y_train)
    
    y_pred = pipeline.predict(X_test)
    rf_mae = mean_absolute_error(y_test, y_pred)
    rf_rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    
    # Baseline: rolling average
    baseline_pred = X_test['rolling_average_cycle_length']
    base_mae = mean_absolute_error(y_test, baseline_pred)
    base_rmse = np.sqrt(mean_squared_error(y_test, baseline_pred))
    
    metadata = {
        "success": True,
        "model_available": True,
        "training_samples": len(X),
        "test_mae": float(rf_mae),
        "test_rmse": float(rf_rmse),
        "baseline_mae": float(base_mae),
        "baseline_rmse": float(base_rmse),
        "improvement": bool(base_mae > rf_mae)
    }
    
    save_model(pipeline, metadata)
    return metadata

if __name__ == '__main__':
    user_id = sys.argv[1]
    res = train_model(user_id)
    print(json.dumps(res))
