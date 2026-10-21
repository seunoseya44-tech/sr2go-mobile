import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ScreenCapture from 'expo-screen-capture';

import { toApiError } from '../../api/errors';
import {
  DISPUTE_LABELS,
  disputeRoomsApi,
  type DisputeCategory,
  type DisputeRoomMessage,
} from '../../api/social';
import { Banner } from '../../components/Banner';
import { Screen } from '../../components/Screen';
import { Chip, LinkText } from '../../components/ui';
import type { AppStackParamList } from '../../navigation/types';
import { colors, radius, spacing, TAP, typography } from '../../theme';
import { shortDate } from '../../utils/format';
import { shared } from '../booking/shared';

type Nav = NativeStackNavigationProp<AppStackParamList>;

/** Screen 42 (21 Oct) · My reports: one room per dispute. */
export function MyReportsScreen() {
  const navigation = useNavigation<Nav>();
  const rooms = useQuery({
    queryKey: ['dispute-rooms'],
    queryFn: disputeRoomsApi.rooms,
    refetchInterval: 30_000,
  });
  return (
    <Screen testID="my-reports" topBar={{ title: 'My reports' }}>
      {rooms.isPending ? <ActivityIndicator color={colors.brand} /> : null}
      {rooms.isError ? <Banner tone="error" message={toApiError(rooms.error).message} /> : null}
      {rooms.data?.length === 0 ? (
        <Text style={shared.subtitle}>
          You have not reported a problem, and no one has reported one on your trips.
        </Text>
      ) : null}
      {rooms.data?.map((r) => (
        <Pressable
          key={r.id}
          onPress={() => navigation.navigate('DisputeRoom', { disputeId: r.id })}
          style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.tile }]}
          accessibilityRole="button"
        >
          <View style={styles.rowBetween}>
            <Text style={styles.semi}>
              {DISPUTE_LABELS[r.category as DisputeCategory] ?? r.category ?? 'Report'}
            </Text>
            <Chip
              label={r.locked ? 'Decided' : (r.status ?? 'open').replace(/_/g, ' ')}
              tone={r.locked ? 'grey' : 'blue'}
            />
          </View>
          <Text style={shared.subtitle}>
            {r.myRole ? `You: ${r.myRole}` : ''}
            {r.openedAt ? ` · Opened ${shortDate(r.openedAt)}` : ''}
            {r.messages != null ? ` · ${r.messages} message${r.messages === 1 ? '' : 's'}` : ''}
          </Text>
        </Pressable>
      ))}
      <LinkText onPress={() => Linking.openURL('https://shareride2go.com/how-we-settle-problems')}>
        How SR2Go settles problems
      </LinkText>
      <LinkText
        onPress={() =>
          Linking.openURL('mailto:support@shareride2go.com?subject=Help with a report')
        }
      >
        Need help? Contact support
      </LinkText>
    </Screen>
  );
}

/** Dispute room: everyone on the trip and SR2Go support add their side, with photos. Read-only once decided. */
export function DisputeRoomScreen() {
  const { params } = useRoute<RouteProp<AppStackParamList, 'DisputeRoom'>>();
  const queryClient = useQueryClient();
  const room = useQuery({
    queryKey: ['dispute-room', params.disputeId],
    queryFn: () => disputeRoomsApi.room(params.disputeId),
    refetchInterval: 15_000,
  });
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: ['dispute-room', params.disputeId] });

  const send = useMutation({
    mutationFn: (t: string) => disputeRoomsApi.postMessage(params.disputeId, t),
    onSuccess: () => {
      setText('');
      refresh();
    },
    onError: (e) => setError(toApiError(e).message),
  });
  const photo = useMutation({
    mutationFn: async (source: 'camera' | 'library') => {
      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) throw new Error('Permission is needed to add a photo.');
      const res =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6 })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
      if (res.canceled || !res.assets[0]) return;
      const a = res.assets[0];
      // 413 above 5 MB: resize to about 1600 px first, as SR2Go asks.
      const small = await manipulateAsync(a.uri, [{ resize: { width: 1600 } }], {
        compress: 0.8,
        format: SaveFormat.JPEG,
      });
      await disputeRoomsApi.uploadPhoto(
        params.disputeId,
        { uri: small.uri, name: 'photo.jpg', type: 'image/jpeg' },
        text.trim(),
      );
    },
    onSuccess: () => {
      setText('');
      refresh();
    },
    onError: (e) => setError(toApiError(e).message),
  });

  const r = room.data ?? null;
  useEffect(() => {
    scroll.current?.scrollToEnd({ animated: true });
  }, [r?.messages.length]);
  useEffect(() => {
    void ScreenCapture.preventScreenCaptureAsync().catch(() => undefined);
    return () => void ScreenCapture.allowScreenCaptureAsync().catch(() => undefined);
  }, []);
  const navigation = useNavigation<Nav>();
  useEffect(() => {
    if (room.isError && toApiError(room.error).status === 404) navigation.goBack();
  }, [room.isError, room.error, navigation]);

  return (
    <Screen
      testID="dispute-room"
      scroll={false}
      topBar={{ title: r ? (DISPUTE_LABELS[r.category as DisputeCategory] ?? 'Report') : 'Report' }}
      contentStyle={styles.content}
      footer={
        r && !r.locked ? (
          <View style={styles.composer}>
            <Pressable
              onPress={() => photo.mutate('camera')}
              style={styles.iconBtn}
              accessibilityRole="button"
              accessibilityLabel="Take a photo"
              disabled={photo.isPending}
            >
              <Ionicons name="camera-outline" size={22} color={colors.navy} />
            </Pressable>
            <Pressable
              onPress={() => photo.mutate('library')}
              style={styles.iconBtn}
              accessibilityRole="button"
              accessibilityLabel="Add a photo"
              disabled={photo.isPending}
            >
              <Ionicons name="image-outline" size={22} color={colors.navy} />
            </Pressable>
            <TextInput
              style={styles.input}
              placeholder="Your side of it"
              placeholderTextColor={colors.textSubtle}
              value={text}
              onChangeText={setText}
              multiline
              accessibilityLabel="Message"
            />
            <Pressable
              onPress={() => text.trim() && send.mutate(text.trim())}
              disabled={!text.trim() || send.isPending}
              style={[styles.send, (!text.trim() || send.isPending) && styles.sendOff]}
              accessibilityRole="button"
              accessibilityLabel="Send"
            >
              {send.isPending || photo.isPending ? (
                <ActivityIndicator color={colors.textOnBrand} />
              ) : (
                <Ionicons name="send" size={20} color={colors.textOnBrand} />
              )}
            </Pressable>
          </View>
        ) : r?.locked ? (
          <Text style={[shared.small, styles.center]}>
            SR2Go has decided this report. The room is read-only.
          </Text>
        ) : undefined
      }
    >
      {error ? <Banner tone="error" message={error} onDismiss={() => setError(null)} /> : null}
      {room.isPending ? <ActivityIndicator color={colors.brand} /> : null}
      {room.isError ? <Banner tone="error" message={toApiError(room.error).message} /> : null}
      {r ? (
        <>
          <View style={styles.rowBetween}>
            <Chip
              label={r.locked ? 'Decided' : (r.status ?? 'open').replace(/_/g, ' ')}
              tone={r.locked ? 'grey' : 'blue'}
            />
            <Text style={shared.small}>
              {r.members.map((m) => `${m.name ?? '?'} (${m.role ?? ''})`).join(' · ')}
            </Text>
          </View>
          {r.description ? <Text style={styles.description}>{r.description}</Text> : null}
          <ScrollView
            ref={scroll}
            style={styles.flex}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          >
            {r.messages.map((m) => (
              <MessageBubble key={m.id} m={m} onPhotoError={refresh} />
            ))}
            {r.messages.length === 0 ? (
              <Text style={[shared.subtitle, styles.center]}>No messages yet.</Text>
            ) : null}
          </ScrollView>
        </>
      ) : null}
    </Screen>
  );
}

function MessageBubble({ m, onPhotoError }: { m: DisputeRoomMessage; onPhotoError?: () => void }) {
  return (
    <View style={[styles.bubbleWrap, m.mine && styles.bubbleWrapMine]}>
      {!m.mine ? (
        <Text style={styles.sender}>
          {m.senderName ?? '—'}
          {m.senderRole ? ` · ${m.senderRole}` : ''}
        </Text>
      ) : null}
      <View
        style={[
          styles.bubble,
          m.mine
            ? styles.bubbleMine
            : m.senderRole === 'support'
              ? styles.bubbleSupport
              : styles.bubbleTheirs,
        ]}
      >
        {m.photoUrl ? (
          <Image
            source={{ uri: m.photoUrl }}
            style={styles.photo}
            accessibilityLabel="Photo"
            onError={onPhotoError}
          />
        ) : null}
        {m.text ? (
          <Text style={[styles.bubbleText, m.mine && styles.bubbleTextMine]}>{m.text}</Text>
        ) : null}
      </View>
      {m.createdAt ? <Text style={styles.time}>{shortDate(m.createdAt)}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flex: 1, gap: spacing.xs, paddingBottom: 0 },
  center: { textAlign: 'center' },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  semi: { ...typography.bodySemibold, color: colors.text, flexShrink: 1 },
  description: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.tile,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  list: { gap: spacing.xs, paddingVertical: spacing.sm },
  bubbleWrap: { alignItems: 'flex-start', maxWidth: '85%' },
  bubbleWrapMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  sender: { ...typography.label, color: colors.textMuted, marginLeft: spacing.xs },
  bubble: {
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  bubbleTheirs: { backgroundColor: colors.tile },
  bubbleSupport: { backgroundColor: colors.brandSoft },
  bubbleMine: { backgroundColor: colors.brand },
  bubbleText: { ...typography.body, color: colors.text },
  bubbleTextMine: { color: colors.textOnBrand },
  photo: { width: 220, height: 220, borderRadius: radius.md, backgroundColor: colors.border },
  time: { ...typography.label, color: colors.textSubtle, marginHorizontal: spacing.xs },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xxs },
  iconBtn: { width: TAP, height: TAP, alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1,
    minHeight: TAP,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    ...typography.body,
    color: colors.text,
  },
  send: {
    width: TAP,
    height: TAP,
    borderRadius: TAP / 2,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendOff: { opacity: 0.4 },
});
