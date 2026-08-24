import pandas as pd
import numpy as np

def generate_features_for_cycle(target_cycle_index, cycles, logs_df, profile):
    """
    Generate features for `cycles[target_cycle_index]`.
    Uses ONLY data STRICTLY before target_cycle_index.
    """
    if target_cycle_index == 0:
        return None
    
    prev_cycle = cycles[target_cycle_index - 1]
    
    # 0% Target Leakage: Slice logs to ONLY include entries from the designated previous cycle
    mask = (logs_df['date'] >= prev_cycle['cycle_start']) & (logs_df['date'] <= prev_cycle['cycle_end'])
    cycle_logs = logs_df[mask]
    
    period_mask = (cycle_logs['date'] >= prev_cycle['period_start']) & (cycle_logs['date'] <= prev_cycle['period_end'])
    period_logs = cycle_logs[period_mask]
    
    features = {}
    
    # 1. Profile numerical encodings
    features['age'] = float(profile.get('age', 25) or 25)
    features['bmi'] = 0.0
    if profile.get('height') and profile.get('weight'):
        h_m = float(profile['height']) / 100
        if h_m > 0:
            features['bmi'] = float(profile['weight']) / (h_m * h_m)
            
    features['exercise_frequency'] = profile.get('exercise_frequency', 'Rarely') or 'Rarely'
    
    # 2. Sequential Cycle History Features
    features['previous_cycle_length'] = float(prev_cycle['cycle_length'])
    features['previous_period_length'] = float(prev_cycle['period_length'])
    
    if target_cycle_index >= 2:
        features['previous_2_cycle_length'] = float(cycles[target_cycle_index - 2]['cycle_length'])
    else:
        features['previous_2_cycle_length'] = features['previous_cycle_length']
        
    hist_lengths = [c['cycle_length'] for c in cycles[:target_cycle_index]]
    features['rolling_average_cycle_length'] = float(np.mean(hist_lengths))
    features['cycle_length_std'] = float(np.std(hist_lengths)) if len(hist_lengths) > 1 else 0.0
    
    # 3. Log Aggregations
    features['average_sleep'] = float(cycle_logs['sleep'].mean()) if not cycle_logs['sleep'].isna().all() else 7.0
    features['average_water'] = float(cycle_logs['water'].mean()) if not cycle_logs['water'].isna().all() else 4.0
    
    stress_map = {'Low': 1, 'Moderate': 2, 'High': 3}
    stress_vals = cycle_logs['stress'].map(stress_map).dropna()
    features['average_stress'] = float(stress_vals.mean()) if not stress_vals.empty else 1.5
    
    features['average_pain_during_period'] = float(period_logs['pain'].mean()) if not period_logs['pain'].isna().all() else 0.0
    
    mood_map = {'Sad': 1, 'Meh': 2, 'Fine': 3, 'Good': 4, 'Great': 5}
    mood_vals = cycle_logs['mood'].map(mood_map).dropna()
    features['average_mood'] = float(mood_vals.mean()) if not mood_vals.empty else 3.0
    
    return features


def build_training_dataset(data):
    from cycle_builder import build_cycles
    
    cycles, _ = build_cycles(data['period_days'])
    
    if len(cycles) < 2:
        return pd.DataFrame(), pd.Series()
        
    logs_df = pd.DataFrame(data['logs'])
    if not logs_df.empty and 'date' in logs_df.columns:
        logs_df['date'] = pd.to_datetime(logs_df['date']).dt.date
    else:
        logs_df = pd.DataFrame(columns=['date', 'sleep', 'water', 'stress', 'pain', 'mood', 'exercise', 'symptoms'])
        
    X_rows = []
    y_values = []
    
    for i in range(1, len(cycles)):
        features = generate_features_for_cycle(i, cycles, logs_df, data['profile'])
        if features:
            X_rows.append(features)
            y_values.append(cycles[i]['cycle_length'])
            
    return pd.DataFrame(X_rows), pd.Series(y_values)


def generate_prediction_features(data):
    from cycle_builder import build_cycles
    cycles, ongoing_cycle = build_cycles(data['period_days'])
    
    if not cycles:
        return None
        
    logs_df = pd.DataFrame(data['logs'])
    if not logs_df.empty and 'date' in logs_df.columns:
        logs_df['date'] = pd.to_datetime(logs_df['date']).dt.date
    else:
        logs_df = pd.DataFrame(columns=['date', 'sleep', 'water', 'stress', 'pain', 'mood', 'exercise', 'symptoms'])
        
    # Append the ongoing cycle strictly as the structural bounding box (since we are predicting inside it)
    dummy_cycles = cycles + [ongoing_cycle] 
    
    features = generate_features_for_cycle(len(cycles), dummy_cycles, logs_df, data['profile'])
    return pd.DataFrame([features])
