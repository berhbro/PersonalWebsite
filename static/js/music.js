const widget = document.querySelector("#musicWidget");
const toggleButton = document.querySelector("#musicToggle");
const panel = document.querySelector(".music-panel");
const audio = document.querySelector("#musicAudio");
const playButton = document.querySelector("#musicPlay");
const prevButton = document.querySelector("#musicPrev");
const nextButton = document.querySelector("#musicNext");
const progress = document.querySelector("#musicProgress");
const currentTimeLabel = document.querySelector("#musicCurrent");
const durationLabel = document.querySelector("#musicDuration");
const titleLabel = document.querySelector("#musicTitle");
const artistLabel = document.querySelector("#musicArtist");
const coverImage = document.querySelector("#musicCover");
const statusLabel = document.querySelector("#musicStatus");
const playlistMeta = document.querySelector("#musicPlaylistMeta");

let isSeeking = false;
let playlist = [];
let currentTrackIndex = 0;
let hasLoadedPlaylist = false;

function setWidgetOpen(isOpen) {
    widget.classList.toggle("is-open", isOpen);
    toggleButton.setAttribute("aria-expanded", String(isOpen));
    panel.setAttribute("aria-hidden", String(!isOpen));
}

function formatTime(seconds) {
    if (!Number.isFinite(seconds)) {
        return "0:00";
    }

    const minutes = Math.floor(seconds / 60);
    const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${minutes}:${rest}`;
}

function setStatus(message) {
    statusLabel.textContent = message;
}

function updateProgress() {
    if (isSeeking || !audio.duration) {
        return;
    }

    progress.value = Math.round((audio.currentTime / audio.duration) * 1000);
    currentTimeLabel.textContent = formatTime(audio.currentTime);
    durationLabel.textContent = formatTime(audio.duration);
}

function updatePlayButton() {
    playButton.textContent = audio.paused ? "播放" : "暂停";
}

async function fetchJson(url) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 14000);

    try {
        const response = await fetch(url, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || "音乐接口请求失败");
        }

        return data;
    } catch (error) {
        if (error.name === "AbortError") {
            throw new Error("歌单加载超时，请稍后再试。");
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

function updateTrackInfo(track) {
    titleLabel.textContent = track.title;
    artistLabel.textContent = track.artist;
    coverImage.src = track.cover || "/static/images/avatar.svg";
    playlistMeta.textContent = `固定歌单 · ${currentTrackIndex + 1}/${playlist.length}`;
}

function loadTrack(index, autoplay = false) {
    if (!playlist.length) {
        setStatus("歌单为空，请先配置 content/music_playlist.json。");
        return;
    }

    currentTrackIndex = (index + playlist.length) % playlist.length;
    const track = playlist[currentTrackIndex];
    updateTrackInfo(track);
    audio.src = track.audio_url;
    progress.value = 0;
    currentTimeLabel.textContent = "0:00";
    durationLabel.textContent = formatTime((track.duration || 0) / 1000);
    setStatus("已加载歌单歌曲，可以播放。");

    if (autoplay) {
        audio.play().then(updatePlayButton).catch(() => {
            setStatus("浏览器阻止了自动播放，请手动点击播放。");
            updatePlayButton();
        });
    } else {
        updatePlayButton();
    }
}

async function loadPlaylist() {
    setStatus("正在加载固定歌单...");
    const data = await fetchJson("/api/music/playlist.json");
    playlist = data.tracks || [];

    if (!playlist.length) {
        titleLabel.textContent = "歌单为空";
        artistLabel.textContent = "请配置 content/music_playlist.json";
        setStatus("没有可播放歌曲。可以填写本地 audio_url，或填写可播放的酷狗 hash。");
        return;
    }

    loadTrack(0);
}

function playNextTrack(autoplay = true) {
    loadTrack(currentTrackIndex + 1, autoplay);
}

function playPreviousTrack() {
    loadTrack(currentTrackIndex - 1, true);
}

toggleButton.addEventListener("click", () => {
    const nextOpenState = !widget.classList.contains("is-open");
    setWidgetOpen(nextOpenState);

    if (nextOpenState && !hasLoadedPlaylist) {
        hasLoadedPlaylist = true;
        loadPlaylist().catch((error) => {
            titleLabel.textContent = "歌单加载失败";
            artistLabel.textContent = "请检查歌单配置";
            setStatus(error.message);
        });
    }
});

playButton.addEventListener("click", async () => {
    if (!audio.src) {
        if (!hasLoadedPlaylist) {
            hasLoadedPlaylist = true;
            await loadPlaylist();
        }

        if (!audio.src) {
            setStatus("还没有可播放的歌曲。");
            return;
        }
    }

    try {
        if (audio.paused) {
            await audio.play();
        } else {
            audio.pause();
        }
        updatePlayButton();
    } catch (error) {
        setStatus("浏览器暂时无法播放这首歌。");
    }
});

prevButton.addEventListener("click", playPreviousTrack);
nextButton.addEventListener("click", () => playNextTrack(true));

progress.addEventListener("input", () => {
    isSeeking = true;
    if (audio.duration) {
        const nextTime = (Number(progress.value) / 1000) * audio.duration;
        currentTimeLabel.textContent = formatTime(nextTime);
    }
});

progress.addEventListener("change", () => {
    if (audio.duration) {
        audio.currentTime = (Number(progress.value) / 1000) * audio.duration;
    }
    isSeeking = false;
});

audio.addEventListener("loadedmetadata", updateProgress);
audio.addEventListener("timeupdate", updateProgress);
audio.addEventListener("play", updatePlayButton);
audio.addEventListener("pause", updatePlayButton);
audio.addEventListener("ended", () => playNextTrack(true));
audio.addEventListener("error", () => {
    setStatus("当前歌曲加载失败，正在切换下一首...");
    if (playlist.length > 1) {
        playNextTrack(true);
    }
});

setStatus("打开音乐组件后会加载你配置好的歌单。");
