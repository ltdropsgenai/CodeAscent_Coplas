/**
 * One-shot: translate the hand-authored puzzle content.
 *
 * check-i18n.mjs only ever scanned groups.json + expansion.groups.json — the
 * GENERATED libraries. The earliest puzzles in puzzles.json were written by
 * hand and never went through a generator, so their themes and explanations
 * were invisible to the coverage check and reported 100% while an English
 * player got Spanish reveals on coplas-0001 onward. Worst possible placement:
 * the first boards anyone plays.
 *
 * House style, same as the rest of groupText.en.json: card names stay Spanish
 * (they are what is painted on the tile), "y" becomes "and", and only the
 * trailing gloss is translated. Rhyme and letter puzzles keep their Spanish
 * syllable splits verbatim — the joke IS the Spanish sound.
 *
 * Run once:  node scripts/fill-puzzle-i18n.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = new URL('../src/data/groupText.en.json', import.meta.url);
const dict = JSON.parse(readFileSync(FILE, 'utf8'));

const THEMES = {
  'Animales del agua': 'Water animals',
  Plantas: 'Plants',
  'Animales que no vuelan': 'Animals that do not fly',
  Personas: 'People',
};

const WHYS = {
  'La Luna, La Estrella, El Sol y El Mundo: todo lo que brilla allá arriba.':
    'La Luna, La Estrella, El Sol and El Mundo: everything that shines up there.',
  'Bande-ra, escale-ra, pe-ra, calave-ra: la misma terminación.':
    'Bande-ra, escale-ra, pe-ra, calave-ra: the same ending.',
  'La Sirena, El Camarón, El Pescado y La Rana viven en el agua.':
    'La Sirena, El Camarón, El Pescado and La Rana all live in the water.',
  'El Gallo, El Pájaro, La Garza y El Cotorro: todos tienen alas.':
    'El Gallo, El Pájaro, La Garza and El Cotorro: all of them have wings.',
  'Rosa, nopal, palma y pino salen de la tierra.':
    'Rosa, nopal, palma and pino all come out of the ground.',
  'Araña, alacrán, venado y rana: animales, pero sin alas. (¡Ojo con las aves!)':
    'Araña, alacrán, venado and rana: animals, but wingless. (Mind the birds!)',
  'Camar-ón, mel-ón, bandol-ón, coraz-ón. El Camarón parecía animal y El Melón, planta: la trampa.':
    'Camar-ón, mel-ón, bandol-ón, coraz-ón. El Camarón looked like an animal and El Melón like a plant: that is the trap.',
  'La Dama, El Catrín, El Valiente y El Soldado: gente de la baraja.':
    'La Dama, El Catrín, El Valiente and El Soldado: people of the deck.',
  'Botella, barril, cantarito y cazo: todos cargan algo líquido.':
    'Botella, barril, cantarito and cazo: they all carry something liquid.',
  'La Muerte, El Diablito, El Alacrán y La Araña dan escalofríos. La Calavera cabía aquí… pero se fue con las rimas.':
    'La Muerte, El Diablito, El Alacrán and La Araña give you chills. La Calavera would have fit here… but it went off with the rhymes.',
  'Sol, Luna, Estrella y Mundo.': 'Sol, Luna, Estrella and Mundo.',
  'Arpa, tambor, violoncello y bandolón.': 'Arpa, tambor, violoncello and bandolón.',
  'Botella, barril, cantarito y cazo.': 'Botella, barril, cantarito and cazo.',
  'Nopal, pino, palma y rosa.': 'Nopal, pino, palma and rosa.',
  'Pino, palma, nopal y rosa.': 'Pino, palma, nopal and rosa.',
  'Gallo, garza, pájaro y cotorro.': 'Gallo, garza, pájaro and cotorro.',
  'Coraz-ón, camar-ón, mel-ón, bandol-ón.': 'Coraz-ón, camar-ón, mel-ón, bandol-ón.',
  'Cazo, cantarito, botella y barril.': 'Cazo, cantarito, botella and barril.',
  'La Dama, El Catrín, El Borracho y El Músico.':
    'La Dama, El Catrín, El Borracho and El Músico.',
  'Escale-ra, pe-ra, bande-ra, calave-ra.': 'Escale-ra, pe-ra, bande-ra, calave-ra.',
  'La Sirena, El Pescado, El Camarón y La Chalupa: cosas del mar.':
    'La Sirena, El Pescado, El Camarón and La Chalupa: things from the sea.',
  'Gallo, garza, pájaro y cotorro: todos tienen alas.':
    'Gallo, garza, pájaro and cotorro: all of them have wings.',
  'Pera, Palma, Paraguas y Pino.': 'Pera, Palma, Paraguas and Pino.',
};

let added = 0;
for (const [es, en] of Object.entries(THEMES)) {
  if (!(es in dict.themes)) added += 1;
  dict.themes[es] = en;
}
for (const [es, en] of Object.entries(WHYS)) {
  if (!(es in dict.whys)) added += 1;
  dict.whys[es] = en;
}

writeFileSync(FILE, JSON.stringify(dict, null, 2) + '\n', 'utf8');
console.log(`added ${added} translations`);
