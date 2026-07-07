import json
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from flask import Flask, abort, jsonify, render_template, request

app = Flask(__name__)

BASE_DIR = Path(__file__).resolve().parent
CONTENT_DIR = BASE_DIR / "content"
BLOG_DIR = CONTENT_DIR / "blogs"
DEMOS_FILE = CONTENT_DIR / "demos.json"
MUSIC_PLAYLIST_FILE = CONTENT_DIR / "music_playlist.json"
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}

profile = {
    "name": "done",
    "title": "来自小池塘大学(GBU)的CS小白",
    "summary": "CS小白，能看懂Python语法，了解过Flask框架，HTML和CSS，能做一些简单的Web开发。努力学习C#和web全栈ing。该网站由我vibecoding开发，后续会继续完善。",
    "skills": ["Python", "Flask", "HTML", "CSS", "Web 开发"],
    "github": "https://github.com/berhbro",
    "bilibili": "https://space.bilibili.com/604167866?",
    "qq_email": "1931912482@qq.com",
}

music_config = {
    "default_keyword": "钢琴曲",
}


def parse_front_matter(markdown_text):
    if not markdown_text.startswith("---"):
        return {}, markdown_text.strip()

    parts = markdown_text.split("---", 2)
    if len(parts) < 3:
        return {}, markdown_text.strip()

    metadata = {}
    for line in parts[1].strip().splitlines():
        if ":" not in line:
            continue

        key, value = line.split(":", 1)
        metadata[key.strip()] = value.strip().strip('"')

    return metadata, parts[2].strip()


def markdown_to_paragraphs(markdown_text):
    blocks = []
    current_block = []

    for line in markdown_text.splitlines():
        cleaned_line = line.strip()
        if not cleaned_line:
            if current_block:
                blocks.append(" ".join(current_block))
                current_block = []
            continue

        current_block.append(cleaned_line)

    if current_block:
        blocks.append(" ".join(current_block))

    return blocks


def load_blog_posts():
    if not BLOG_DIR.exists():
        return []

    posts = []
    for blog_path in sorted(BLOG_DIR.glob("*.md")):
        markdown_text = blog_path.read_text(encoding="utf-8")
        metadata, body = parse_front_matter(markdown_text)
        slug = metadata.get("slug") or blog_path.stem

        posts.append(
            {
                "slug": slug,
                "title": metadata.get("title") or slug.replace("-", " ").title(),
                "date": metadata.get("date") or "",
                "excerpt": metadata.get("excerpt") or "",
                "content": markdown_to_paragraphs(body),
            }
        )

    return sorted(posts, key=lambda post: post["date"], reverse=True)


def load_demos():
    if not DEMOS_FILE.exists():
        return []

    demos = json.loads(DEMOS_FILE.read_text(encoding="utf-8"))
    if not isinstance(demos, list):
        return []

    normalized_demos = []
    for demo in demos:
        name = demo.get("name", "未命名作品")
        slug = demo.get("slug") or name.lower().replace(" ", "-")
        normalized_demos.append(
            {
                "slug": slug,
                "name": name,
                "description": demo.get("description", ""),
                "tags": demo.get("tags", []),
                "github": demo.get("github", ""),
                "video": demo.get("video", {}),
                "document": demo.get("document", []),
            }
        )

    return normalized_demos


def load_music_playlist():
    if not MUSIC_PLAYLIST_FILE.exists():
        return []

    tracks = json.loads(MUSIC_PLAYLIST_FILE.read_text(encoding="utf-8"))
    if not isinstance(tracks, list):
        return []

    normalized_tracks = []
    for index, track in enumerate(tracks, start=1):
        normalized_tracks.append(
            {
                "title": track.get("title") or f"Track {index}",
                "artist": track.get("artist") or "未知歌手",
                "audio_url": track.get("audio_url", ""),
                "cover": track.get("cover", ""),
                "hash": track.get("hash", ""),
                "album_id": track.get("album_id", ""),
            }
        )

    return normalized_tracks


def resolve_playlist_track(track):
    if track["audio_url"]:
        return {
            "title": track["title"],
            "artist": track["artist"],
            "audio_url": track["audio_url"],
            "cover": track["cover"],
            "duration": 0,
        }

    if not track["hash"]:
        return None

    try:
        detail = get_song_detail(track["hash"], track["album_id"])
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError):
        return None

    if not detail["audio_url"]:
        return None

    return {
        "title": track["title"] or detail["title"],
        "artist": track["artist"] or detail["artist"],
        "audio_url": detail["audio_url"],
        "cover": track["cover"] or detail["cover"],
        "duration": detail["duration"],
    }


def get_album_photos():
    album_dir = Path(app.static_folder) / "images" / "album"
    if not album_dir.exists():
        return []

    photos = []
    for image_path in sorted(album_dir.iterdir()):
        if image_path.suffix.lower() not in ALLOWED_IMAGE_EXTENSIONS:
            continue
        if image_path.stem.lower() == "avatar":
            continue

        photos.append(
            {
                "src": f"images/album/{image_path.name}",
                "title": image_path.stem,
            }
        )

    return photos


def fetch_kugou_json(url, params, timeout=6):
    query = urlencode(params)
    api_url = f"{url}?{query}"
    api_request = Request(
        api_url,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Referer": "https://www.kugou.com/",
        },
    )

    with urlopen(api_request, timeout=timeout) as response:
        payload = response.read().decode("utf-8", errors="ignore")
        return json.loads(payload)


def search_kugou_songs(keyword):
    search_attempts = [
        (
            "http://mobilecdn.kugou.com/api/v3/search/song",
            {
                "format": "json",
                "keyword": keyword,
                "page": 1,
                "pagesize": 8,
                "showtype": 1,
            },
            "info",
        ),
        (
            "https://songsearch.kugou.com/song_search_v2",
            {
                "keyword": keyword,
                "page": 1,
                "pagesize": 8,
                "platform": "WebFilter",
                "iscorrection": 1,
            },
            "lists",
        ),
    ]

    last_error = None
    for url, params, list_key in search_attempts:
        try:
            data = fetch_kugou_json(url, params)
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
            last_error = error
            continue

        items = ((data.get("data") or {}).get(list_key)) or []
        songs = [normalize_song_item(item) for item in items]
        songs = [song for song in songs if song["hash"]]
        if songs:
            return sorted(songs, key=lambda song: song["is_paid"])

    if last_error:
        raise last_error

    return []


def normalize_song_item(item):
    pay_type = item.get("pay_type", item.get("PayType", item.get("HQPayType", 0)))
    privilege = item.get("privilege", item.get("Privilege", 0))
    fail_process = item.get("fail_process", item.get("FailProcess", item.get("HQFailProcess", 0)))

    return {
        "name": item.get("songname")
        or item.get("SongName")
        or item.get("filename")
        or item.get("FileName")
        or "未知歌曲",
        "artist": item.get("singername")
        or item.get("SingerName")
        or item.get("author_name")
        or item.get("Singer")
        or "未知歌手",
        "hash": item.get("hash")
        or item.get("FileHash")
        or item.get("HQFileHash")
        or item.get("SQFileHash")
        or item.get("audio_id"),
        "album_id": item.get("album_id") or item.get("albumid") or item.get("AlbumID") or "",
        "duration": item.get("duration") or item.get("Duration") or item.get("timelength") or 0,
        "is_paid": any(str(value) not in ("", "0", "None") for value in (pay_type, privilege, fail_process)),
    }


def normalize_cover_url(url):
    return (url or "").replace("{size}", "240")


def first_backup_url(backup_url):
    if isinstance(backup_url, str):
        return backup_url
    if isinstance(backup_url, list) and backup_url:
        return backup_url[0]
    if isinstance(backup_url, dict):
        for value in backup_url.values():
            if isinstance(value, list) and value:
                return value[0]
            if isinstance(value, str) and value:
                return value
    return ""


def normalize_duration(value):
    try:
        duration = int(value or 0)
    except (TypeError, ValueError):
        return 0

    if 0 < duration < 10000:
        return duration * 1000
    return duration


def get_mobile_song_detail(song_hash):
    data = fetch_kugou_json(
        "https://m.kugou.com/app/i/getSongInfo.php",
        {
            "cmd": "playInfo",
            "hash": song_hash,
        },
        timeout=5,
    )

    audio_url = data.get("url") or first_backup_url(data.get("backup_url"))
    duration = normalize_duration(data.get("timeLength"))
    if not duration:
        duration = normalize_duration(((data.get("extra") or {}).get("128timelength")))

    return {
        "title": data.get("songName") or data.get("fileName") or "未知歌曲",
        "artist": data.get("singerName") or data.get("author_name") or "未知歌手",
        "audio_url": audio_url,
        "cover": normalize_cover_url(data.get("album_img") or data.get("imgUrl")),
        "duration": duration,
        "lyrics": "",
    }


def get_web_song_detail(song_hash, album_id=""):
    data = fetch_kugou_json(
        "https://wwwapi.kugou.com/yy/index.php",
        {
            "r": "play/getdata",
            "hash": song_hash,
            "album_id": album_id,
            "mid": "personal_website_player",
            "platid": 4,
        },
        timeout=5,
    )
    song = data.get("data") or {}

    return {
        "title": song.get("song_name") or song.get("audio_name") or "未知歌曲",
        "artist": song.get("author_name") or "未知歌手",
        "audio_url": song.get("play_url") or song.get("play_backup_url") or "",
        "cover": normalize_cover_url(song.get("img") or ""),
        "duration": normalize_duration(song.get("timelength")),
        "lyrics": song.get("lyrics") or "",
    }


def get_song_detail(song_hash, album_id=""):
    detail_errors = []
    for getter in (get_mobile_song_detail, lambda current_hash: get_web_song_detail(current_hash, album_id)):
        try:
            detail = getter(song_hash)
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
            detail_errors.append(error)
            continue

        if detail["audio_url"]:
            return detail

    if detail_errors:
        raise detail_errors[-1]

    return {
        "title": "未知歌曲",
        "artist": "未知歌手",
        "audio_url": "",
        "cover": "",
        "duration": 0,
        "lyrics": "",
    }


@app.route("/")
def index():
    return render_template(
        "index.html",
        profile=profile,
        demos=load_demos(),
        blog_posts=load_blog_posts(),
        music_config=music_config,
        album_photos=get_album_photos(),
    )


@app.route("/blog/<slug>")
def blog_detail(slug):
    post = next((item for item in load_blog_posts() if item["slug"] == slug), None)
    if post is None:
        abort(404)

    return render_template("blog_detail.html", profile=profile, post=post)


@app.route("/demos")
def demos_library():
    return render_template(
        "demos.html",
        profile=profile,
        demos=load_demos(),
    )


@app.route("/gallery")
def gallery():
    return render_template(
        "gallery.html",
        profile=profile,
        album_photos=get_album_photos(),
    )


@app.route("/api/music/search")
def music_search():
    keyword = request.args.get("keyword", music_config["default_keyword"]).strip()
    if not keyword:
        return jsonify({"songs": []})

    try:
        songs = search_kugou_songs(keyword)
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
        return jsonify({"error": f"酷狗搜索接口暂时不可用：{error}"}), 502

    return jsonify({"songs": songs})


@app.route("/api/music/playlist")
def music_playlist():
    tracks = []
    for track in load_music_playlist():
        resolved_track = resolve_playlist_track(track)
        if resolved_track is not None:
            tracks.append(resolved_track)

    return jsonify({"tracks": tracks})


@app.route("/api/music/song")
def music_song():
    song_hash = request.args.get("hash", "").strip()
    album_id = request.args.get("album_id", "").strip()
    if not song_hash:
        return jsonify({"error": "缺少歌曲 hash 参数"}), 400

    try:
        song = get_song_detail(song_hash, album_id)
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
        return jsonify({"error": f"酷狗播放接口暂时不可用：{error}"}), 502

    if not song["audio_url"]:
        return jsonify({"error": "这首歌暂时没有可播放链接，请换一首试试。"}), 404

    return jsonify(song)


@app.route("/api/music/default")
def music_default():
    keyword = request.args.get("keyword", music_config["default_keyword"]).strip()

    try:
        songs = search_kugou_songs(keyword)
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
        return jsonify({"error": f"酷狗搜索接口暂时不可用：{error}"}), 502

    for song in songs[:2]:
        try:
            detail = get_song_detail(song["hash"], song.get("album_id", ""))
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError):
            continue

        if detail["audio_url"]:
            return jsonify(detail)

    return jsonify({"error": "暂时没有找到可播放歌曲，请搜索其他关键词。"}), 404


if __name__ == "__main__":
    app.run(debug=True)
