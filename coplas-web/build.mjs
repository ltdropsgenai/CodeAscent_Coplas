/**
 * Generates the static site from one source of truth.
 *
 * The prose here is copied verbatim from app/legal.tsx in the Coplas repo,
 * with one deliberate correction: the app's copy still says art, music and
 * animation stream from the server, which stopped being true when the deck
 * was bundled. Only the animated clips stream now. legal.tsx needs the same
 * edit — a privacy page that overstates what leaves the device is the kind of
 * inaccuracy App Review reads as a red flag.
 *
 * Run: node build.mjs   → writes index.html, privacy.html, terms.html, support.html
 */
import { writeFileSync, mkdirSync, copyFileSync } from 'node:fs';

// Vercel serves OUT/. Everything the site needs is generated or copied into it,
// so the deployed tree has exactly one source of truth: this file.
const OUT = new URL('./public/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const UPDATED = '2026-07-31';
// MUST match SUPPORT_EMAIL in src/support.ts, which app/legal.tsx imports.
// This file cannot import the TS module, so the value is repeated here and
// asserted by scripts/check-legal-parity.mjs rather than trusted to memory.
const CONTACT = 'sysadmin@codeascent.online';
const DECK = 995;
const IOS = 'https://apps.apple.com/app/id6796142121';
const PLAY = 'https://play.google.com/store/apps/details?id=com.codeascent.coplas';

const NAV = {
  es: { about: 'Acerca de', privacy: 'Privacidad', terms: 'Términos', support: 'Soporte' },
  en: { about: 'About', privacy: 'Privacy', terms: 'Terms', support: 'Support' },
};

/** Escape nothing — the copy is authored here and contains no markup. */
const blocks = (bs) =>
  bs.map((b) => (b.h ? `<h2>${b.h}</h2>\n` : '') + `<p${b.lede ? ' class="lede"' : ''}>${b.p}</p>`).join('\n');

const page = ({ slug, title, body }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · Coplas</title>
<meta name="description" content="Coplas — a word game inspired by the Mexican lotería. Find the four groups of four.">
<meta name="theme-color" content="#070510">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='4' fill='%230b0a1f'/%3E%3Crect x='6' y='5' width='20' height='22' rx='2' fill='none' stroke='%23f4b942' stroke-width='2'/%3E%3Ccircle cx='16' cy='16' r='5' fill='%23f4b942'/%3E%3C/svg%3E">
<meta property="og:title" content="${title} · Coplas">
<meta property="og:description" content="A word game inspired by the Mexican lotería. Sixteen cards, four groups of four.">
<meta property="og:type" content="website">
<link rel="stylesheet" href="/style.css">
<script src="/lang.js"></script>
</head>
<body>
<div class="wrap">

<header class="mast">
  <a class="mark" href="/">Copl<span>as</span></a>
  <nav class="mast-nav">
    <a href="/"${slug === 'index' ? ' aria-current="page"' : ''} data-nav="about"></a>
    <a href="/privacy"${slug === 'privacy' ? ' aria-current="page"' : ''} data-nav="privacy"></a>
    <a href="/terms"${slug === 'terms' ? ' aria-current="page"' : ''} data-nav="terms"></a>
    <a href="/support"${slug === 'support' ? ' aria-current="page"' : ''} data-nav="support"></a>
  </nav>
</header>

<div class="langbar">
  <button type="button" data-set-lang="es">Español</button>
  <button type="button" data-set-lang="en">English</button>
</div>

${body}

<footer>
  <div data-lang="es"><p>Coplas es un proyecto de CodeAscent. Escríbenos a <a href="mailto:${CONTACT}">${CONTACT}</a>.</p></div>
  <div data-lang="en"><p>Coplas is a CodeAscent project. Write to us at <a href="mailto:${CONTACT}">${CONTACT}</a>.</p></div>
</footer>

</div>
<script>
// Nav labels follow the chosen language. Doing it here rather than duplicating
// the whole masthead twice keeps one nav in the DOM for screen readers.
(function () {
  var L = ${JSON.stringify(NAV)};
  function paint() {
    var lang = document.documentElement.classList.contains('es') ? 'es' : 'en';
    document.querySelectorAll('[data-nav]').forEach(function (a) {
      a.textContent = L[lang][a.getAttribute('data-nav')];
    });
  }
  paint();
  new MutationObserver(paint).observe(document.documentElement, { attributeFilter: ['class'] });
})();
</script>
</body>
</html>
`;

/* ------------------------------------------------------------------ pages */

const doc = (title_es, title_en, es, en) => `
<div data-lang="es">
  <h1>${title_es}</h1><div class="rule"></div>
  <p class="updated">Actualizado · ${UPDATED}</p>
  ${blocks(es)}
</div>
<div data-lang="en">
  <h1>${title_en}</h1><div class="rule"></div>
  <p class="updated">Updated · ${UPDATED}</p>
  ${blocks(en)}
</div>`;

const landing = `
<div data-lang="es">
  <div class="hero">
    <h1>Encuentra los cuatro grupos de cuatro</h1>
    <p class="lede">Un juego de palabras inspirado en la lotería mexicana. Dieciséis cartas, cuatro grupos, cuatro errores.</p>
    <div class="stores">
      <a class="store" href="${IOS}">App Store</a>
      <a class="store secondary" href="${PLAY}">Google Play</a>
    </div>
  </div>
  <div class="cards">
    <div class="card"><h3>Casi mil cartas</h3><p>Ilustradas a mano, con su nombre en español impreso en el naipe. Mucho más allá de las 54 clásicas.</p></div>
    <div class="card"><h3>Rondas infinitas</h3><p>No hay un solo puzle diario. Cada ronda se compone al momento desde cientos de categorías verificadas.</p></div>
    <div class="card"><h3>Juega sin conexión</h3><p>La baraja entera viaja dentro de la app. Solo las animaciones se transmiten.</p></div>
    <div class="card"><h3>Sin anuncios ni cuentas</h3><p>No te pedimos registro ni correo. Nada tuyo sale del teléfono.</p></div>
  </div>
</div>
<div data-lang="en">
  <div class="hero">
    <h1>Find the four groups of four</h1>
    <p class="lede">A word game inspired by the Mexican lotería. Sixteen cards, four groups, four mistakes.</p>
    <div class="stores">
      <a class="store" href="${IOS}">App Store</a>
      <a class="store secondary" href="${PLAY}">Google Play</a>
    </div>
  </div>
  <div class="cards">
    <div class="card"><h3>Nearly a thousand cards</h3><p>Illustrated by hand, each with its Spanish name printed on the card. Far past the classic 54.</p></div>
    <div class="card"><h3>Endless rounds</h3><p>There's no single daily puzzle. Every round is composed on the spot from hundreds of hand-verified categories.</p></div>
    <div class="card"><h3>Plays offline</h3><p>The whole deck ships inside the app. Only the animated clips stream.</p></div>
    <div class="card"><h3>No ads, no accounts</h3><p>We don't ask you to register or hand over an email. Nothing of yours leaves the phone.</p></div>
  </div>
</div>`;

const PAGES = [
  { slug: 'index', title: 'Coplas', body: landing },

  {
    slug: 'privacy',
    title: 'Privacy',
    body: doc('Privacidad', 'Privacy',
      [
        { lede: true, p: 'La versión corta: Coplas no te pide una cuenta, no te identifica y no recoge datos personales.' },
        { h: 'Lo que se queda en tu teléfono', p: 'Tu racha, tus partidas, tus logros y tus preferencias de idioma, sonido y dificultad se guardan únicamente en el almacenamiento local de tu dispositivo. No se envían a ningún servidor y desaparecen si borras la app.' },
        { h: 'Lo que sale de tu teléfono', p: `Las ${DECK} ilustraciones, los efectos de sonido, las voces y la música viajan dentro de la app: no se descargan. Lo único que se transmite desde nuestro almacenamiento en Supabase son los clips animados de las cartas. Como en cualquier descarga por internet, ese servidor registra técnicamente la petición y la dirección IP desde la que llega, del mismo modo que al abrir una página web. No asociamos esos registros con ninguna persona ni los usamos para perfilar a nadie.` },
        { h: 'Recordatorios', p: 'Si activas el recordatorio diario, la notificación la programa tu propio teléfono y se queda en él. No hay notificaciones push desde ningún servidor, y por tanto no existe ningún identificador de dispositivo registrado con nosotros.' },
        { h: 'Lo que no hacemos', p: 'No hay anuncios. No hay analítica de terceros. No hay SDK de seguimiento, ni identificadores publicitarios, ni venta o intercambio de datos. La app no pide acceso a tus contactos, tu ubicación, tu cámara, tu micrófono ni tus fotos. Si compartes tu resultado, se abre la hoja de compartir del sistema y tú eliges a dónde va — nosotros no vemos nada.' },
        { h: 'Menores', p: 'Coplas es apta para todo público y, como no recoge datos de nadie, tampoco recoge datos de menores.' },
        { h: 'Tus derechos', p: `Como no guardamos datos tuyos, no hay nada que pedirnos que borremos: desinstalar la app elimina todo. Si tienes dudas, escríbenos a <a href="mailto:${CONTACT}">${CONTACT}</a>.` },
      ],
      [
        { lede: true, p: 'The short version: Coplas asks for no account, does not identify you, and collects no personal data.' },
        { h: 'What stays on your phone', p: 'Your streak, your played rounds, your achievements and your language, sound and difficulty preferences are stored only in your device’s local storage. They are never sent to a server, and they disappear if you delete the app.' },
        { h: 'What leaves your phone', p: `All ${DECK} illustrations, the sound effects, the voices and the music travel inside the app — none of them are downloaded. The only thing that streams from our Supabase storage is the animated card clips. As with any download over the internet, that server technically logs the request and the IP address it came from, exactly as it would if you opened a web page. We do not tie those logs to any person or use them to profile anyone.` },
        { h: 'Reminders', p: 'If you turn on the daily reminder, your own phone schedules that notification and it stays there. There are no push notifications from any server, and so there is no device identifier registered with us.' },
        { h: 'What we don’t do', p: 'No ads. No third-party analytics. No tracking SDKs, no advertising identifiers, no selling or sharing of data. The app does not ask for your contacts, location, camera, microphone or photos. If you share a result, the system share sheet opens and you choose where it goes — we see none of it.' },
        { h: 'Children', p: 'Coplas is suitable for all ages and, since it collects data from nobody, it collects no data from children.' },
        { h: 'Your rights', p: `Because we hold no data about you, there is nothing to ask us to delete — uninstalling the app removes everything. Questions are welcome at <a href="mailto:${CONTACT}">${CONTACT}</a>.` },
      ]),
  },

  {
    slug: 'terms',
    title: 'Terms',
    body: doc('Términos y condiciones', 'Terms & conditions',
      [
        { lede: true, p: 'Al usar Coplas aceptas estos términos. Son breves a propósito.' },
        { h: 'Uso de la app', p: 'Te damos permiso personal y no exclusivo de usar Coplas para jugar. No puedes revenderla, redistribuirla, descompilarla ni extraer sus ilustraciones, música o datos de juego para usarlos en otro producto.' },
        { h: 'Contenido', p: 'Las ilustraciones, la música, los textos y el diseño de Coplas son nuestros o los usamos con licencia. La lotería como tradición es patrimonio cultural mexicano y es de todos; nuestras versiones concretas de las cartas, no. Cualquier marca registrada de terceros que se mencione pertenece a su titular y se usa únicamente de forma descriptiva.' },
        { h: 'Sin garantías', p: 'Coplas se ofrece tal cual. Hacemos lo posible por que funcione y por que las agrupaciones sean justas, pero no prometemos que esté libre de errores ni disponible sin interrupciones. Puede cambiar o dejar de existir.' },
        { h: 'Compras', p: 'Si en el futuro añadimos compras dentro de la app, las procesa la tienda desde la que instalaste Coplas — App Store o Google Play — y aplican sus reglas de reembolso, no las nuestras.' },
        { h: 'Cambios', p: 'Si estos términos cambian, actualizaremos la fecha de arriba. Seguir usando la app después de un cambio significa que lo aceptas.' },
      ],
      [
        { lede: true, p: 'By using Coplas you accept these terms. They are short on purpose.' },
        { h: 'Using the app', p: 'We grant you a personal, non-exclusive right to use Coplas to play. You may not resell it, redistribute it, decompile it, or extract its artwork, music or game data for use in another product.' },
        { h: 'Content', p: 'The illustrations, music, text and design of Coplas are ours or licensed to us. Lotería as a tradition is Mexican cultural heritage and belongs to everyone; our particular renderings of the cards do not. Any third-party trademark mentioned belongs to its owner and is used descriptively only.' },
        { h: 'No warranties', p: 'Coplas is provided as is. We work to keep it running and the groupings fair, but we do not promise it is free of bugs or always available. It may change or stop existing.' },
        { h: 'Purchases', p: 'If we add in-app purchases later, whichever store you installed Coplas from — the App Store or Google Play — processes them, and that store’s refund rules apply, not ours.' },
        { h: 'Changes', p: 'If these terms change we will update the date above. Continuing to use the app after a change means you accept it.' },
      ]),
  },

  {
    slug: 'support',
    title: 'Support',
    body: doc('Soporte', 'Support',
      [
        { lede: true, p: `Escríbenos a <a href="mailto:${CONTACT}">${CONTACT}</a>. Contestamos a todo, normalmente en un par de días.` },
        { h: 'Una agrupación te pareció injusta', p: 'Es lo que más nos interesa saber. Dinos qué categoría era y qué cartas salieron — una captura de pantalla basta — y la revisamos. Si una carta encaja en dos grupos del mismo tablero, es un error nuestro, no tuyo.' },
        { h: 'Perdiste tu racha o tus estadísticas', p: 'Las estadísticas viven solo en tu teléfono, así que borrar la app o cambiar de dispositivo las borra. No hay copia en la nube y no podemos recuperarlas: no tenemos ninguna cuenta tuya que consultar.' },
        { h: 'Una carta no se ve o no se anima', p: 'Las ilustraciones viajan dentro de la app, así que deberían verse siempre, incluso sin conexión. Las animaciones sí se transmiten y necesitan señal. Si una carta sale en blanco, cuéntanos cuál y con qué teléfono.' },
        { h: 'El sonido no funciona', p: 'Revisa el interruptor de silencio del teléfono y los ajustes de sonido dentro de la app. Si sigue mudo, dinos el modelo del teléfono.' },
        { h: 'Reembolsos', p: 'Las compras las procesa App Store o Google Play, no nosotros, así que los reembolsos se piden directamente a la tienda. Nosotros no podemos emitirlos, pero si algo no funcionó como esperabas cuéntanoslo igual.' },
        { h: 'Borrar tus datos', p: 'Desinstalar la app borra todo. No guardamos nada tuyo en ningún servidor, así que no hay nada más que borrar.' },
      ],
      [
        { lede: true, p: `Write to <a href="mailto:${CONTACT}">${CONTACT}</a>. We answer everything, usually within a couple of days.` },
        { h: 'A grouping felt unfair', p: 'This is the thing we most want to hear about. Tell us which category it was and which cards came up — a screenshot is enough — and we will look at it. If a card fits two groups on the same board, that is our mistake, not yours.' },
        { h: 'You lost your streak or your stats', p: 'Stats live only on your phone, so deleting the app or switching devices clears them. There is no cloud backup and we cannot restore them: there is no account of yours for us to look up.' },
        { h: 'A card is blank or will not animate', p: 'The illustrations travel inside the app, so they should always appear, even with no signal. The animations do stream and need a connection. If a card comes up blank, tell us which one and which phone.' },
        { h: 'No sound', p: 'Check your phone’s silent switch and the sound settings inside the app. If it is still silent, tell us the phone model.' },
        { h: 'Refunds', p: 'Purchases are processed by the App Store or Google Play, not by us, so refunds are requested from the store directly. We cannot issue them, but if something did not work the way you expected, tell us anyway.' },
        { h: 'Deleting your data', p: 'Uninstalling the app deletes everything. We keep nothing of yours on any server, so there is nothing further to erase.' },
      ]),
  },
];

for (const p of PAGES) {
  writeFileSync(new URL(`./${p.slug}.html`, OUT), page(p));
  console.log('wrote', p.slug + '.html');
}
for (const asset of ['style.css', 'lang.js']) {
  copyFileSync(new URL(`./${asset}`, import.meta.url), new URL(`./${asset}`, OUT));
  console.log('copied', asset);
}
console.log(`\n${PAGES.length} pages + 2 assets -> public/. Updated stamp: ${UPDATED}.`);
