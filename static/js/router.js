function isSkippableLink(link) {
    if (!link.href) {
        return true;
    }

    const url = new URL(link.href);
    const isExternal = url.origin !== window.location.origin;
    const hasSpecialTarget = link.target && link.target !== "_self";
    const isDownload = link.hasAttribute("download");
    const isMailOrTel = ["mailto:", "tel:"].includes(url.protocol);

    return isExternal || hasSpecialTarget || isDownload || isMailOrTel;
}

function scrollToTarget(hash) {
    if (!hash) {
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
    }

    const target = document.querySelector(hash);
    if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
}

async function navigateWithoutReload(url, shouldPushState = true) {
    const response = await fetch(url, {
        headers: {
            "X-Requested-With": "fetch",
        },
    });

    if (!response.ok) {
        window.location.href = url;
        return;
    }

    const html = await response.text();
    const nextDocument = new DOMParser().parseFromString(html, "text/html");
    const nextMain = nextDocument.querySelector("main");
    const currentMain = document.querySelector("main");

    if (!nextMain || !currentMain) {
        window.location.href = url;
        return;
    }

    currentMain.innerHTML = nextMain.innerHTML;
    document.title = nextDocument.title;

    if (shouldPushState) {
        window.history.pushState({}, "", url);
    }

    window.initPageWidgets?.();
    scrollToTarget(new URL(url, window.location.origin).hash);
}

document.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (!link || isSkippableLink(link)) {
        return;
    }

    const url = new URL(link.href);
    const isSamePath = url.pathname === window.location.pathname && url.search === window.location.search;

    event.preventDefault();

    if (isSamePath) {
        if (url.hash) {
            window.history.pushState({}, "", url);
            scrollToTarget(url.hash);
        }
        return;
    }

    navigateWithoutReload(url).catch(() => {
        window.location.href = url;
    });
});

window.addEventListener("popstate", () => {
    navigateWithoutReload(window.location.href, false).catch(() => {
        window.location.reload();
    });
});
