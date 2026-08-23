import os
import psycopg2
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

def get_connection():
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        raise ValueError("DATABASE_URL is not set inside .env!")
    return psycopg2.connect(db_url)

def fetch_user_data(user_id):
    """
    Fetches raw information available for a given user from the Postgres DB.
    """
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            # 1. Fetch user profile stats
            cur.execute("SELECT age, height, weight, avg_cycle_length, avg_period_length, exercise_frequency, conditions FROM users WHERE id = %s", (user_id,))
            profile_row = cur.fetchone()
            if not profile_row:
                return None
            profile = {
                'age': profile_row[0],
                'height': profile_row[1],
                'weight': profile_row[2],
                'avg_cycle_length': profile_row[3],
                'avg_period_length': profile_row[4],
                'exercise_frequency': profile_row[5],
                'conditions': profile_row[6]
            }

            # 2. Fetch all period mark days natively to group into actual bleeding events
            cur.execute("SELECT date FROM period_days WHERE user_id = %s ORDER BY date ASC", (user_id,))
            period_days = [row[0] for row in cur.fetchall()]

            # 3. Fetch all daily logs
            # mood, flow, pain, sleep, water, exercise, stress, symptoms
            cur.execute("""
                SELECT date, mood, flow, pain, sleep, water, exercise, stress, symptoms 
                FROM logs 
                WHERE user_id = %s ORDER BY date ASC
            """, (user_id,))
            logs = []
            for row in cur.fetchall():
                logs.append({
                    'date': row[0],
                    'mood': row[1],
                    'flow': row[2],
                    'pain': row[3],
                    'sleep': row[4],
                    'water': row[5],
                    'exercise': row[6],
                    'stress': row[7],
                    'symptoms': row[8]
                })

            return {
                'profile': profile,
                'period_days': period_days,
                'logs': logs
            }
    finally:
        conn.close()
