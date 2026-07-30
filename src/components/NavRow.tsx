import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { colors, displayFont, floatShadow } from '../theme';
import { cardThumb } from '../data/cardImages';

export const NAV_ICON_W = 36;
export const NAV_ICON_H = 48;

/**
 * A menu row: a card from our own deck as the icon, a serif label, a dim hint,
 * and a gold chevron — separated from its neighbours by a hairline instead of
 * being wrapped in a panel. Using deck cards as icons means the menu is
 * unmistakably Coplas and carries no icon-font dependency.
 *
 * CAREFUL — the row layout lives on the inner `<View>`, never on the
 * `<Pressable>`: expo-router's `<Link asChild>` clones its child into an `<a>`
 * on web and does not reliably apply a *function* style, which silently drops
 * `flexDirection: 'row'` and leaves the chevron wrapped onto its own line.
 */
export function NavRow({
  href,
  label,
  hint,
  icon,
  first,
}: {
  href: string;
  label: string;
  hint?: string;
  icon: string;
  /** Suppresses the top hairline on the first row of a group. */
  first?: boolean;
}) {
  return (
    <Link href={href as never} asChild>
      <Pressable style={({ pressed }) => [styles.press, pressed && styles.pressed]}>
        <View style={[styles.row, !first && styles.divider]}>
          <Image source={{ uri: cardThumb(icon, NAV_ICON_W, NAV_ICON_H) }} style={styles.icon} />
          {/* flex:1 keeps the chevron pinned to the right edge. */}
          <View style={styles.body}>
            <Text style={styles.label}>{label}</Text>
            {!!hint && <Text style={styles.hint}>{hint}</Text>}
          </View>
          <Text style={styles.chevron}>›</Text>
        </View>
      </Pressable>
    </Link>
  );
}

/** Small mono kicker that titles a group of rows. No box, just type. */
export function NavGroupLabel({ children }: { children: string }) {
  return <Text style={styles.groupLabel}>{children.toUpperCase()}</Text>;
}

const styles = StyleSheet.create({
  press: { width: '100%' },
  pressed: { opacity: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13 },
  divider: { borderTopWidth: 1, borderTopColor: 'rgba(244,185,66,0.15)' },
  icon: {
    width: NAV_ICON_W,
    height: NAV_ICON_H,
    borderRadius: 4,
    marginRight: 14,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  body: { flex: 1 },
  label: { color: colors.text, fontFamily: displayFont, fontSize: 18, fontWeight: '700', ...floatShadow },
  hint: { color: colors.textDim, fontSize: 12, marginTop: 2, ...floatShadow },
  chevron: { color: colors.accent, fontSize: 26, fontWeight: '400', marginLeft: 10, opacity: 0.7 },
  groupLabel: {
    color: colors.accent,
    fontSize: 10,
    letterSpacing: 2.4,
    opacity: 0.85,
    marginTop: 26,
    marginBottom: 2,
    fontWeight: '800',
    ...floatShadow,
  },
});
