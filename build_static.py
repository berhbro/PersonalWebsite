import json
import shutil
from pathlib import Path

from app import app, load_blog_posts

BASE_DIR = Path(__file__).resolve().parent
DIST_DIR = BASE_DIR / "dist"


def write_bytes(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)


def export_route(client, route, output_path):
    response = client.get(route)
    if response.status_code != 200:
        raise RuntimeError(f"Failed to export {route}: HTTP {response.status_code}")

    write_bytes(DIST_DIR / output_path, response.data)


def main():
    if DIST_DIR.exists():
        shutil.rmtree(DIST_DIR)

    shutil.copytree(BASE_DIR / "static", DIST_DIR / "static")

    with app.test_client() as client:
        export_route(client, "/", "index.html")
        export_route(client, "/demos", "demos/index.html")
        export_route(client, "/gallery", "gallery/index.html")

        for post in load_blog_posts():
            export_route(client, f"/blog/{post['slug']}", f"blog/{post['slug']}/index.html")

        playlist_response = client.get("/api/music/playlist.json")
        if playlist_response.status_code != 200:
            raise RuntimeError(f"Failed to export playlist: HTTP {playlist_response.status_code}")

        playlist_data = playlist_response.get_json()
        playlist_output = json.dumps(playlist_data, ensure_ascii=False, indent=2).encode("utf-8")
        write_bytes(DIST_DIR / "api/music/playlist.json", playlist_output)

    print(f"Static site exported to {DIST_DIR}")


if __name__ == "__main__":
    main()
