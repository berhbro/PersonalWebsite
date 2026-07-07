let albumCarouselTimer = null;
let hasBoundLightboxEscape = false;

function initAlbumCarousel() {
    const albumCarousel = document.querySelector("[data-album-carousel]");
    if (albumCarouselTimer) {
        clearInterval(albumCarouselTimer);
        albumCarouselTimer = null;
    }

    if (!albumCarousel) {
        return;
    }

    const slides = [...albumCarousel.querySelectorAll(".album-slide")];
    const dots = [...albumCarousel.querySelectorAll("[data-carousel-dot]")];
    let activeIndex = 0;

    function showSlide(nextIndex) {
        if (!slides.length) {
            return;
        }

        activeIndex = (nextIndex + slides.length) % slides.length;
        slides.forEach((slide, index) => slide.classList.toggle("is-active", index === activeIndex));
        dots.forEach((dot, index) => dot.classList.toggle("is-active", index === activeIndex));
    }

    dots.forEach((dot) => {
        dot.addEventListener("click", () => {
            showSlide(Number(dot.dataset.carouselDot));
        });
    });

    if (slides.length > 1) {
        albumCarouselTimer = setInterval(() => showSlide(activeIndex + 1), 3200);
    }
}

function closeLightbox() {
    const lightbox = document.querySelector("#galleryLightbox");
    const lightboxImage = document.querySelector("#lightboxImage");
    if (!lightbox || !lightboxImage) {
        return;
    }

    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    lightboxImage.src = "";
}

function initGalleryLightbox() {
    const lightbox = document.querySelector("#galleryLightbox");
    const lightboxImage = document.querySelector("#lightboxImage");
    const lightboxTitle = document.querySelector("#lightboxTitle");
    const lightboxClose = document.querySelector(".lightbox-close");
    const galleryItems = [...document.querySelectorAll(".gallery-item")];

    galleryItems.forEach((item) => {
        item.addEventListener("click", () => {
            if (!lightbox || !lightboxImage || !lightboxTitle) {
                return;
            }

            lightboxImage.src = item.dataset.fullSrc;
            lightboxImage.alt = item.querySelector("img").alt;
            lightboxTitle.textContent = item.dataset.title;
            lightbox.classList.add("is-open");
            lightbox.setAttribute("aria-hidden", "false");
        });
    });

    if (lightboxClose) {
        lightboxClose.addEventListener("click", closeLightbox);
    }

    if (lightbox) {
        lightbox.addEventListener("click", (event) => {
            if (event.target === lightbox) {
                closeLightbox();
            }
        });
    }

    if (!hasBoundLightboxEscape) {
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                closeLightbox();
            }
        });
        hasBoundLightboxEscape = true;
    }
}

window.initPageWidgets = function initPageWidgets() {
    initAlbumCarousel();
    initGalleryLightbox();
};

window.initPageWidgets();
