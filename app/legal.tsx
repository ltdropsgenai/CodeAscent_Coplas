import { useLayoutEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, displayFont, floatShadow, monoFont } from '../src/theme';
import { useI18n } from '../src/i18n';
import { CARDS } from '../src/data/cards';
import { ANIMATED_COUNT } from '../src/data/cardVideos';

/**
 * The three informational pages — about, terms, privacy — behind one route.
 *
 * They share an identical shape (a title, a last-updated stamp and a run of
 * headed prose), so three separate screens would be three copies of the same
 * layout. `/legal?doc=terms|privacy|about` keeps the router flat and the
 * styling in one place.
 *
 * NOTE FOR SUBMISSION: App Store Connect requires a privacy policy at a public
 * HTTPS URL — an in-app page does not satisfy that field. The text below is the
 * canonical source; publish the same copy to a web page and point ASC at it.
 * This copy is a good-faith description of what the app actually does, not
 * legal advice; have it reviewed before the app goes public.
 */

type Doc = 'about' | 'terms' | 'privacy';
type Block = { h?: string; p: string };

const UPDATED = '2026-07-30';
const CONTACT = 'tlondi@gmail.com';
// Read from the deck itself so the copy can never drift out of date as the
// deck and the animation run grow.
const DECK_SIZE = CARDS.length;
const ANIMATED = ANIMATED_COUNT;

const DOCS: Record<'es' | 'en', Record<Doc, { title: string; blocks: Block[] }>> = {
  es: {
    about: {
      title: 'Acerca de Coplas',
      blocks: [
        {
          p: 'Coplas es un juego de palabras inspirado en la Lotería mexicana. Cada ronda reparte dieciséis cartas que esconden cuatro grupos de cuatro; tu trabajo es encontrar qué las une — una familia, una rima, un color, una trampa — antes de gastar tus errores.',
        },
        {
          h: 'La baraja',
          p: 'La baraja va mucho más allá de las 54 cartas clásicas: ' + DECK_SIZE + ' cartas ilustradas, cada una con su nombre en español impreso en el naipe, y ' + ANIMATED + ' de ellas animadas. El arte, la música y las animaciones se transmiten desde nuestro servidor, así que la primera partida del día carga un poco antes de acomodarse.',
        },
        {
          h: 'Hecho por',
          p: 'Coplas es un proyecto de CodeAscent. Si algo se ve raro, se oye raro o se siente injusto, escríbenos: ' + CONTACT + '. Leemos todo.',
        },
      ],
    },
    terms: {
      title: 'Términos y condiciones',
      blocks: [
        {
          p: 'Al usar Coplas aceptas estos términos. Son breves a propósito.',
        },
        {
          h: 'Uso de la app',
          p: 'Te damos permiso personal y no exclusivo de usar Coplas para jugar. No puedes revenderla, redistribuirla, descompilarla ni extraer sus ilustraciones, música o datos de juego para usarlos en otro producto.',
        },
        {
          h: 'Contenido',
          p: 'Las ilustraciones, la música, los textos y el diseño de Coplas son nuestros o los usamos con licencia. La Lotería como tradición es patrimonio cultural mexicano y es de todos; nuestras versiones concretas de las cartas, no.',
        },
        {
          h: 'Sin garantías',
          p: 'Coplas se ofrece tal cual. Hacemos lo posible por que funcione y por que las agrupaciones sean justas, pero no prometemos que esté libre de errores ni disponible sin interrupciones. Puede cambiar o dejar de existir.',
        },
        {
          h: 'Compras',
          p: 'Si en el futuro añadimos compras dentro de la app, las procesa Apple y aplican sus reglas de reembolso, no las nuestras.',
        },
        {
          h: 'Cambios',
          p: 'Si estos términos cambian, actualizaremos la fecha de arriba. Seguir usando la app después de un cambio significa que lo aceptas.',
        },
      ],
    },
    privacy: {
      title: 'Privacidad',
      blocks: [
        {
          p: 'La versión corta: Coplas no te pide una cuenta, no te identifica y no recoge datos personales.',
        },
        {
          h: 'Lo que se queda en tu teléfono',
          p: 'Tu racha, tus partidas, tus preferencias de idioma, sonido y dificultad se guardan únicamente en el almacenamiento local de tu dispositivo. No se envían a ningún servidor y desaparecen si borras la app.',
        },
        {
          h: 'Lo que sale de tu teléfono',
          p: 'La app descarga las ilustraciones, la música y los clips animados desde nuestro almacenamiento en Supabase. Como en cualquier descarga por internet, ese servidor registra técnicamente la petición y la dirección IP desde la que llega, del mismo modo que al abrir una página web. No asociamos esos registros con ninguna persona ni los usamos para perfilar a nadie.',
        },
        {
          h: 'Lo que no hacemos',
          p: 'No hay anuncios. No hay analítica de terceros. No hay SDK de seguimiento, ni identificadores publicitarios, ni venta o intercambio de datos. La app no pide acceso a tus contactos, tu ubicación, tu cámara, tu micrófono ni tus fotos. Si compartes tu resultado, se abre la hoja de compartir del sistema y tú eliges a dónde va — nosotros no vemos nada.',
        },
        {
          h: 'Menores',
          p: 'Coplas es apta para todo público y, como no recoge datos de nadie, tampoco recoge datos de menores.',
        },
        {
          h: 'Tus derechos',
          p: 'Como no guardamos datos tuyos, no hay nada que pedirnos que borremos: desinstalar la app elimina todo. Si tienes dudas, escríbenos a ' + CONTACT + '.',
        },
      ],
    },
  },
  en: {
    about: {
      title: 'About Coplas',
      blocks: [
        {
          p: 'Coplas is a word game built on the Mexican Lotería. Each round deals sixteen cards hiding four groups of four; your job is to spot what binds them — a family, a rhyme, a colour, a trap — before your mistakes run out.',
        },
        {
          h: 'The deck',
          p: 'The deck runs far past the classic 54: ' + DECK_SIZE + ' illustrated cards, each with its Spanish name printed on the card itself, and ' + ANIMATED + ' of them animated. Art, music and animation stream from our server, so the first round of the day loads briefly before it settles.',
        },
        {
          h: 'Made by',
          p: 'Coplas is a CodeAscent project. If something looks wrong, sounds wrong or feels unfair, write to us at ' + CONTACT + '. We read everything.',
        },
      ],
    },
    terms: {
      title: 'Terms & conditions',
      blocks: [
        { p: 'By using Coplas you accept these terms. They are short on purpose.' },
        {
          h: 'Using the app',
          p: 'We grant you a personal, non-exclusive right to use Coplas to play. You may not resell it, redistribute it, decompile it, or extract its artwork, music or game data for use in another product.',
        },
        {
          h: 'Content',
          p: 'The illustrations, music, text and design of Coplas are ours or licensed to us. Lotería as a tradition is Mexican cultural heritage and belongs to everyone; our particular renderings of the cards do not.',
        },
        {
          h: 'No warranties',
          p: 'Coplas is provided as is. We work to keep it running and the groupings fair, but we do not promise it is free of bugs or always available. It may change or stop existing.',
        },
        {
          h: 'Purchases',
          p: 'If we add in-app purchases later, Apple processes them and Apple’s refund rules apply, not ours.',
        },
        {
          h: 'Changes',
          p: 'If these terms change we will update the date above. Continuing to use the app after a change means you accept it.',
        },
      ],
    },
    privacy: {
      title: 'Privacy',
      blocks: [
        {
          p: 'The short version: Coplas asks for no account, does not identify you, and collects no personal data.',
        },
        {
          h: 'What stays on your phone',
          p: 'Your streak, your played rounds and your language, sound and difficulty preferences are stored only in your device’s local storage. They are never sent to a server, and they disappear if you delete the app.',
        },
        {
          h: 'What leaves your phone',
          p: 'The app downloads its illustrations, music and animated clips from our Supabase storage. As with any download over the internet, that server technically logs the request and the IP address it came from, exactly as it would if you opened a web page. We do not tie those logs to any person or use them to profile anyone.',
        },
        {
          h: 'What we don’t do',
          p: 'No ads. No third-party analytics. No tracking SDKs, no advertising identifiers, no selling or sharing of data. The app does not ask for your contacts, location, camera, microphone or photos. If you share a result, the system share sheet opens and you choose where it goes — we see none of it.',
        },
        {
          h: 'Children',
          p: 'Coplas is suitable for all ages and, since it collects data from nobody, it collects no data from children.',
        },
        {
          h: 'Your rights',
          p: 'Because we hold no data about you, there is nothing to ask us to delete — uninstalling the app removes everything. Questions are welcome at ' + CONTACT + '.',
        },
      ],
    },
  },
};

export default function Legal() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { lang } = useI18n();
  const { doc } = useLocalSearchParams<{ doc?: string }>();

  const key: Doc = doc === 'terms' || doc === 'privacy' ? doc : 'about';
  const content = DOCS[lang][key];

  useLayoutEffect(() => {
    navigation.setOptions({ title: content.title });
  }, [navigation, content.title]);

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 40 }]}>
      <Text style={styles.title}>{content.title}</Text>
      <View style={styles.rule} />
      <Text style={styles.updated}>
        {lang === 'es' ? 'Actualizado' : 'Updated'} · {UPDATED}
      </Text>

      {content.blocks.map((b, i) => (
        <View key={i} style={styles.block}>
          {!!b.h && <Text style={styles.h}>{b.h}</Text>}
          <Text style={styles.p}>{b.p}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 6 },
  title: { color: colors.text, fontFamily: displayFont, fontSize: 28, fontWeight: '700', ...floatShadow },
  rule: { width: 48, height: 3, borderRadius: 2, backgroundColor: colors.accent, marginTop: 10, opacity: 0.85 },
  updated: {
    color: colors.textDim,
    fontFamily: monoFont,
    fontSize: 10,
    letterSpacing: 1.4,
    marginTop: 12,
    opacity: 0.8,
    ...floatShadow,
  },
  block: { marginTop: 22 },
  h: {
    color: colors.accent,
    fontFamily: displayFont,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
    ...floatShadow,
  },
  p: { color: colors.text, fontSize: 14, lineHeight: 22, opacity: 0.92, ...floatShadow },
});
