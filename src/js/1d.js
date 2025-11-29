// Register GSAP plugins first
gsap.registerPlugin(ScrollTrigger, ScrollToPlugin, SplitText, ScrollSmoother);

console.clear();

// Helper functions
const select = (e) => document.querySelector(e);
const selectAll = (e) => document.querySelectorAll(e);

// --- Main Initialization ---
document.addEventListener("DOMContentLoaded", function() {

    const stage = select(".stage");
    
    // This makes sure fonts are loaded before splitting the text.
    window.addEventListener("load", () => {
        
        // Initialize SplitText here
        let introTitle = new SplitText(".intro__title", {
            type: "lines",
            linesClass: "intro-line"
        });
        
        new SplitText(".col__content-title", {
            type: "lines",
            linesClass: "line"
        });

        // Start animations now that everything is truly ready
        initIntro(introTitle.lines);
        initSlides();
        initParallax();
    });

    // Create the smoother instance with adjusted settings
    const smoother = ScrollSmoother.create({
        smooth: 1.4,
        effects: true,
        smoothTouch: 0.1,
    });

    // These functions can run earlier.
    initHeader();
    initLinks();
    initKeys();
    initLangSwitcher(); // Initialize the language switcher
    
    gsap.set(stage, { autoAlpha: 1 });
});


// --- Language Switcher Function ---
function initLangSwitcher() {
    const html = document.documentElement;
    const langButtons = document.querySelectorAll('.lang-btn');

    // Function to set the language
    const setLanguage = (lang) => {
        // Only set language if it's one of the valid options
        if (['en', 'es', 'fr'].includes(lang)) {
            html.setAttribute('lang', lang);
            localStorage.setItem('chatwallet-lang', lang); // Save preference
            
            // Update active button state
            langButtons.forEach(btn => {
                if (btn.getAttribute('data-lang') === lang) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }
    };

    // Add click event listeners
    langButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const lang = button.getAttribute('data-lang');
            setLanguage(lang);
        });
    });

    // Check for a language parameter in the URL first.
    const urlParams = new URLSearchParams(window.location.search);
    const langFromUrl = urlParams.get('lang');

    if (langFromUrl) {
        // If a language is found in the URL, use it immediately.
        setLanguage(langFromUrl);
    } else {
        // If not, check for a saved language in localStorage.
        const savedLang = localStorage.getItem('chatwallet-lang') || 'en'; // Default to English.
        setLanguage(savedLang);
    }
}


// --- Animation Functions with Adjusted Timings ---
function initHeader() {
    // We only animate the logo now, since the nav button was removed.
    gsap.from(".logo", {
        delay: 0.5,
        y: -40,
        opacity: 0,
        duration: 1.5,
        ease: "power4"
    });
}
// function initHeader() {
//     let tl = gsap.timeline({ delay: 0.5 });
//     tl.from(".logo", {
//         y: -40,
//         opacity: 0,
//         duration: 1.5, // Faster
//         ease: "power4"
//     }).from(".nav-btn__svg rect", {
//         scale: 0,
//         transformOrigin: "center right",
//         duration: 0.6,
//         ease: "power4",
//         stagger: 0.1
//     }, 0.3); // Starts sooner
// }


// REPLACE your old initIntro function with this one
function initIntro() {
    let tl = gsap.timeline({ delay: 0.2 });
    tl.from(".hero__title", {
        y: 100,
        opacity: 0,
        duration: 1.5,
        ease: "power4.out"
    })
    .from([".hero__tagline", ".hero__description"], {
        y: 50,
        opacity: 0,
        duration: 1.2,
        ease: "power4.out",
        stagger: 0.2
    }, "-=1")
    .from(".hero__cta-group a", {
        y: 30,
        opacity: 0,
        duration: 1,
        ease: "power3.out",
        stagger: 0.15
    }, "-=0.8");
}

// function initIntro(introLines) {
//     let tl = gsap.timeline({ delay: 0.2 });
//     tl.from(introLines, {
//         y: 250, // Slightly less travel
//         opacity: 0,
//         duration: 1.5, // Faster
//         ease: "power4.out"
//     }).from(".intro__txt", {
//         x: -100,
//         opacity: 0,
//         duration: 1.5,
//         ease: "power4.out"
//     }, 0.5).from(".intro__img--1", {
//         y: 50,
//         opacity: 0,
//         duration: 2, // Faster
//         ease: "power2.out"
//     }, 0.7);

//     gsap.to(".intro__img--1", {
//         y: -50,
//         ease: "none",
//         scrollTrigger: {
//             trigger: ".intro",
//             scrub: 1,
//         }
//     });
// }

function initLinks() {
    const links = selectAll(".slide__scroll-link");
    links.forEach((link, index) => {
        const targetSlide = `#slide-${index + 1}`;
        link.addEventListener("click", (e) => {
            e.preventDefault();
            gsap.to(window, {
                duration: 1.5, // Faster scroll
                scrollTo: { y: targetSlide },
                ease: "power2.inOut"
            });
        });
    });
    
    const top = select(".footer__link-top");
    top.addEventListener("click", (e) => {
        e.preventDefault();
        scrollTop();
    });
}

// Slides animation with snappier timings
function initSlides() {
    const slides = selectAll('.slide');
    slides.forEach((slide) => {
        const line = slide.querySelector(".line");
        const txt = slide.querySelector(".col__content-txt");
        const link = slide.querySelector(".slide-link");

        let tl = gsap.timeline({
            scrollTrigger: {
                trigger: slide,
                start: "top 60%", // Trigger animation sooner
            }
        });

        if(line) {
            tl.from(line, {
                yPercent: 100,
                duration: 1, // Faster
                ease: "power3.out"
            });
        }
        if(txt) {
             tl.from(txt, {
                opacity: 0,
                y: 50,
                duration: 1, // Faster
                ease: "power3.out"
            }, "-=0.7"); // Overlap animation
        }
        if(link) {
            tl.from(link, {
                opacity: 0,
                y: 50,
                duration: 1,
                ease: "power3.out"
            }, "-=0.7");
        }
    });
}

// Parallax animation without the 'snap' for a smoother feel
function initParallax() {
    gsap.utils.toArray('.col__image-wrap').forEach(wrapper => {
        const image = wrapper.querySelector('img');
        gsap.to(image, {
            yPercent: 20, // Adjust the amount of parallax
            ease: "none",
            scrollTrigger: {
                trigger: wrapper,
                scrub: 1, // Smooth scrubbing
            }
        });
    });
}


function scrollTop() {
    gsap.to(window, {
        duration: 1.5, // Faster scroll
        scrollTo: { y: 0 },
        ease: "power3.inOut"
    });
}

function initKeys() {
    let slideID = 0;
    const slides = selectAll(".slide");
    document.addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            if (slideID < slides.length) {
                slideID++;
                gsap.to(window, { duration: 1.5, scrollTo: { y: `#slide-${slideID}` }, ease: "power2.inOut" });
            }
        } else if (e.key === "ArrowUp") {
             e.preventDefault();
            if (slideID > 0) {
                slideID--;
                 gsap.to(window, { duration: 1.5, scrollTo: { y: `#slide-${slideID}` }, ease: "power2.inOut" });
            }
        }
    });
}