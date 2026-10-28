import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import build_static


def add_prefix(value, prefix):
    if value.startswith("/") and not value.startswith("//"):
        return prefix + value
    return value


def prepare_html(path, prefix):
    html = path.read_text(encoding="utf-8")
    html = re.sub(r'<a\s+href="/static/admin/index\.html"[^>]*>管理</a>', "", html)
    html = html.replace('/static/images/avatar.svg', '/static/images/avatar.jpg')

    def replace_attribute(match):
        return match.group(1) + add_prefix(match.group(2), prefix) + match.group(3)

    html = re.sub(r'((?:href|src|data-full-src)="|\bposter=")(/(?!/)[^"]*)(")', replace_attribute, html)
    path.write_text(html, encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-path", default="/PersonalWebsite")
    args = parser.parse_args()
    prefix = "/" + args.base_path.strip("/") if args.base_path.strip("/") else ""

    build_static.DIST_DIR = ROOT / "github-pages" / "dist"
    build_static.main()
    output = build_static.DIST_DIR

    for path in output.rglob("*.html"):
        prepare_html(path, prefix)

    music_path = output / "static/js/music.js"
    music = music_path.read_text(encoding="utf-8")
    music = music.replace('"/api/music/playlist.json"', f'"{prefix}/api/music/playlist.json"')
    music = music.replace('"/static/images/avatar.svg"', f'"{prefix}/static/images/avatar.jpg"')
    music_path.write_text(music, encoding="utf-8")

    playlist_path = output / "api/music/playlist.json"
    playlist = json.loads(playlist_path.read_text(encoding="utf-8"))
    for track in playlist.get("tracks", []):
        for field in ("audio_url", "cover"):
            track[field] = add_prefix(track.get(field, ""), prefix)
    playlist_path.write_text(json.dumps(playlist, ensure_ascii=False, indent=2), encoding="utf-8")
    (output / ".nojekyll").touch()
    print(f"GitHub Pages site exported to {output} (base path: {prefix or '/'})")


if __name__ == "__main__":
    main()
