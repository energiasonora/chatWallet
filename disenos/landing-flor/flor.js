/* Flor de la Vida para los modelos de la landing.
   La variante sale de <html data-flor="halo semilla …">; cada palabra prende una integración. */
(function () {
    var S3 = Math.sqrt(3);
    var html = document.documentElement;
    var modos = (html.getAttribute('data-flor') || '').split(/\s+/);
    function tiene(m) { return modos.indexOf(m) >= 0; }

    // Centros de la grilla hexagonal hasta la distancia n (n=1: semilla, 7; n=2: flor, 19),
    // del centro hacia afuera y en ronda, para que al dibujarse florezca.
    function puntos(n) {
        var p = [];
        for (var q = -n; q <= n; q++) for (var r = -n; r <= n; r++) {
            var d = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
            if (d <= n) p.push({ x: q + r / 2, y: r * S3 / 2, d: d });
        }
        p.sort(function (a, b) { return a.d - b.d || Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x); });
        return p;
    }

    function flor(o) {
        var n = o.n || 2, R = n + 1, m = R + 0.22;
        var s = '<svg class="flor ' + (o.clase || '') + '" viewBox="' + (-m) + ' ' + (-m) + ' ' + 2 * m + ' ' + 2 * m + '" aria-hidden="true" fill="none" stroke="currentColor">';
        puntos(n).forEach(function (p, i) {
            s += '<circle class="flor__c" style="--i:' + i + '" cx="' + p.x.toFixed(4) + '" cy="' + p.y.toFixed(4) + '" r="1" pathLength="1"/>';
        });
        if (o.marco !== false) s += '<circle class="flor__m" style="--i:' + (n === 1 ? 7 : 19) + '" r="' + R + '" pathLength="1"/><circle class="flor__m" style="--i:' + (n === 1 ? 8 : 20) + '" r="' + (R + 0.12) + '" pathLength="1"/>';
        return s + '</svg>';
    }
    window.florSVG = flor;

    // Se dibuja cuando entra en pantalla.
    var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('ver'); io.unobserve(e.target); } });
    }, { threshold: 0.25 }) : null;
    function mirar(el) { if (io) io.observe(el); else el.classList.add('ver'); }

    // 1 · Halo: la flor grande detrás del gato ninja, girando muy despacio.
    if (tiene('halo')) {
        var ninja = document.querySelector('.ninja');
        if (ninja) {
            var col = ninja.parentElement;
            col.classList.add('flor-halo-col');
            col.insertAdjacentHTML('afterbegin', flor({ n: 2, clase: 'flor-halo' }));
            // en el tema oscuro el gato va en una tarjeta blanca: ahí la flor va adentro
            ninja.insertAdjacentHTML('afterbegin', flor({ n: 2, clase: 'flor-halo flor-halo--tarjeta' }));
            setTimeout(function () { col.querySelectorAll('.flor-halo').forEach(function (f) { f.classList.add('ver'); }); }, 250);
        }
    }

    // 2 · Semilla que crece: cada sección prende un círculo de la Semilla de la Vida
    //     (01 → 1 … 06 → 6) y el cierre la completa y florece en la Flor entera.
    if (tiene('semilla')) {
        document.querySelectorAll('section .num').forEach(function (el, k) {
            el.classList.add('num--flor');
            el.insertAdjacentHTML('afterbegin', flor({ n: 1, marco: false, clase: 'flor-num' }));
            var svg = el.querySelector('svg');
            svg.querySelectorAll('.flor__c').forEach(function (c, i) { if (i <= k) c.classList.add('on'); });
            mirar(svg);
        });
        var cierre = document.querySelector('.cierre');
        if (cierre) {
            cierre.classList.add('cierre--flor');
            cierre.insertAdjacentHTML('afterbegin', flor({ n: 2, clase: 'flor-cierre' }));
            mirar(cierre.querySelector('.flor-cierre'));
        }
    }

    // 3 · Meditación: en «Custodiá» la flor reemplaza al enso alrededor del gato que medita,
    //     y el logo lleva la Semilla girando detrás.
    if (tiene('meditacion')) {
        var enso = document.querySelector('.enso');
        if (enso) {
            enso.classList.add('enso--flor');
            enso.querySelector('svg').outerHTML = flor({ n: 2, clase: 'flor-enso' });
        }
        document.querySelectorAll('.marca__logo').forEach(function (l) {
            l.classList.add('marca__logo--flor');
            l.insertAdjacentHTML('afterbegin', flor({ n: 1, clase: 'flor-logo' }));
            l.querySelector('svg').classList.add('ver');
        });
    }

    // 4 · Trama: el tejido infinito de la flor como textura detrás del título y del cierre.
    if (tiene('trama')) {
        function tejido(color) {
            var R = 30, W = R, H = R * S3, c = '';
            for (var j = -2; j <= 4; j++) for (var i = -2; i <= 3; i++) {
                var x = i * R + (j % 2 ? R / 2 : 0), y = j * H / 2;
                c += '<circle cx="' + x.toFixed(2) + '" cy="' + y.toFixed(2) + '" r="' + R + '"/>';
            }
            var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H.toFixed(3) + '" viewBox="0 0 ' + W + ' ' + H.toFixed(3) + '" fill="none" stroke="' + color + '" stroke-width="1">' + c + '</svg>';
            return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
        }
        html.style.setProperty('--tejido-claro', tejido('rgba(124,77,255,.22)'));
        html.style.setProperty('--tejido-oscuro', tejido('rgba(165,139,255,.16)'));
    }
})();
