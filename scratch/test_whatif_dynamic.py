import requests

url = "http://localhost:8000/whatif"
payloads = [
    {"segment": "Potential Loyalist", "feature": "recency", "delta_pct": 20.0},
    {"segment": "Potential Loyalist", "feature": "recency", "delta_pct": 47.0},
    {"segment": "Potential Loyalist", "feature": "recency", "delta_pct": 10.0}
]

for p in payloads:
    try:
        # Note: This assumes the backend is running and has data loaded.
        # Since I'm in a terminal, I'll just check if I can hit the local server if it's up.
        # If not, I'll just check the code again.
        r = requests.post(url, json=p)
        print(f"Input {p['delta_pct']}% -> Recommendation: {r.json().get('recommendation')}")
    except:
        print(f"Could not connect to {url}")
