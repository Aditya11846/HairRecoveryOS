import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { color, radius, space, type } from '../theme/tokens';

export default function ListRow({ icon, name, desc, right, onPress, last, style }) {
  const Container = onPress ? TouchableOpacity : View;
  const containerProps = onPress ? { onPress, activeOpacity: 0.7 } : {};
  return (
    <Container {...containerProps} style={[s.row, !last && s.border, style]}>
      {icon != null && (
        <View style={s.iconWrap}>
          {icon}
        </View>
      )}
      <View style={s.body}>
        <Text style={s.name}>{name}</Text>
        {desc ? <Text style={s.desc}>{desc}</Text> : null}
      </View>
      {right != null && <View style={s.right}>{right}</View>}
      {onPress && <Text style={s.chevron}>›</Text>}
    </Container>
  );
}

const s = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: space.lg },
  border:  { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  iconWrap: {
    width: 34, height: 34, borderRadius: radius.row,
    backgroundColor: '#000', borderWidth: StyleSheet.hairlineWidth, borderColor: color.line,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  body:    { flex: 1 },
  name:    { ...type.bodyStrong },
  desc:    { fontSize: 12, color: color.dim, marginTop: 2 },
  right:   { marginLeft: space.sm },
  chevron: { fontSize: 20, color: color.faint, marginLeft: 6 },
});
