import urllib.request

if __name__ == "__main__":
    routes = ['/', '/market-analysis', '/model-architecture', '/about', '/analytics', '/model', '/404-test']
    for r in routes:
        url = f"http://127.0.0.1:5173{r}"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=5) as resp:
            print(f"Route: {r} -> HTTP {resp.status} (Serving {resp.headers.get('content-type', '')})")

    print("\nALL SPA ROUTES SERVING 200 CLEANLY ON VITE!")
