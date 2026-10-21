import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';

import { useQuery } from '@tanstack/react-query';

import { toApiError } from '../api/errors';
import { searchPlacesLive } from '../api/places';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { Banner } from '../components/Banner';
import { Chip, Subtext } from '../components/ui';
import type { AppStackParamList } from '../navigation/types';
import { postRide } from '../state/postRide';
import { searchForm } from '../state/searchForm';
import { colors, spacing, typography } from '../theme';

/**
 * From/To picker. Temporary list-based search until the Google Maps key
 * arrives; the screen contract (returns a Place with lat/lng and city) stays
 * the same when it is swapped for Places autocomplete.
 */
export function PlacePickerScreen() {
  const navigation = useNavigation();
  const { params } = useRoute<RouteProp<AppStackParamList, 'PlacePicker'>>();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(t);
  }, [query]);
  const live = useQuery({
    queryKey: ['places', debounced],
    queryFn: () => searchPlacesLive(debounced),
    placeholderData: (prev) => prev,
  });
  const results = live.data ?? [];

  return (
    <Screen
      testID="place-picker"
      scroll={false}
      topBar={{ leading: 'close', title: params.field === 'origin' ? 'From' : 'To' }}
      contentStyle={styles.content}
    >
      <TextField
        testID="place-query"
        label="Search a place"
        placeholder="e.g. Ojota, Lagos"
        icon="search-outline"
        value={query}
        onChangeText={setQuery}
        autoFocus
        autoCorrect={false}
        returnKeyType="search"
      />
      <Subtext>Type a city, town or area. SR2Go hubs are listed first.</Subtext>
      {live.isError && toApiError(live.error).status === 429 ? (
        <Banner message="Please wait a moment." />
      ) : null}
      <FlatList
        data={results}
        keyExtractor={(p) => p.name}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const selected = params.current?.name === item.name;
          return (
            <Pressable
              onPress={() => {
                const patch = params.field === 'origin' ? { origin: item } : { destination: item };
                if (params.target === 'post') postRide.set(patch);
                else searchForm.set(patch);
                navigation.goBack();
              }}
              accessibilityRole="button"
              testID={`place-${item.name}`}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <Ionicons name="location-outline" size={20} color={colors.brand} />
              <View style={styles.rowText}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.city}>{item.detail ?? item.city}</Text>
              </View>
              {item.hub ? <Chip label="Hub" tone="blue" /> : null}
              {selected ? <Ionicons name="checkmark" size={20} color={colors.brand} /> : null}
            </Pressable>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>No places match. Try a city name.</Text>}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowPressed: { backgroundColor: colors.tile },
  rowText: { flex: 1 },
  name: { ...typography.body, color: colors.text },
  city: { ...typography.secondary, color: colors.textMuted },
  empty: { ...typography.body, color: colors.textMuted, paddingVertical: spacing.lg },
});
