import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRoute, type RouteProp } from '@react-navigation/native';
import * as Crypto from 'expo-crypto';

import { toApiError } from '../../api/errors';
import { chatApi, parseChat, tundeApi, type ChatMessage, type TundeTurn } from '../../api/social';
import { useAuth } from '../../auth/AuthContext';
import { Banner } from '../../components/Banner';
import { Screen } from '../../components/Screen';
import { Avatar, Chip } from '../../components/ui';
import type { AppStackParamList } from '../../navigation/types';
import { secureStorage } from '../../storage/secureStorage';
import { colors, fonts, radius, spacing, TAP, typography } from '../../theme';
import { shared } from '../booking/shared';

const RETENTION_LINE =
  'Messages in this chat are kept by SR2Go and may be reviewed if there is a problem on this trip.';

function Bubble({ m }: { m: ChatMessage }) {
  return (
    <View style={[styles.bubbleWrap, m.mine && styles.bubbleWrapMine]}>
      {!m.mine && m.senderName ? (
        <Text style={styles.sender}>
          {m.senderName}
          {m.senderRole ? ` · ${m.senderRole === 'driver' ? 'Driver' : 'Passenger'}` : ''}
        </Text>
      ) : null}
      <View style={[styles.bubble, m.mine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <Text style={[styles.bubbleText, m.mine && styles.bubbleTextMine]}>{m.text}</Text>
      </View>
    </View>
  );
}

function Composer({
  placeholder,
  onSend,
  disabled,
  sending,
}: {
  placeholder: string;
  onSend: (t: string) => void;
  disabled?: boolean;
  sending?: boolean;
}) {
  const [text, setText] = useState('');
  const submit = () => {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText('');
  };
  return (
    <View style={styles.composer}>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.textSubtle}
        value={text}
        onChangeText={setText}
        editable={!disabled}
        multiline
        onSubmitEditing={submit}
        accessibilityLabel={placeholder}
      />
      <Pressable
        onPress={submit}
        disabled={disabled || !text.trim()}
        style={[styles.send, (disabled || !text.trim()) && styles.sendOff]}
        accessibilityRole="button"
        accessibilityLabel="Send"
      >
        {sending ? (
          <ActivityIndicator color={colors.textOnBrand} />
        ) : (
          <Ionicons name="send" size={20} color={colors.textOnBrand} />
        )}
      </Pressable>
    </View>
  );
}

/** Screen 43 · Trip chat: one group chat per trip. WebSocket when it connects, polling otherwise. */
export function TripChatScreen() {
  const { params } = useRoute<RouteProp<AppStackParamList, 'TripChat'>>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const myId = user?.id ?? null;
  const history = useQuery({
    queryKey: ['chat', params.rideId],
    queryFn: () => chatApi.history(params.rideId, myId),
    refetchInterval: 10_000,
  });
  const [live, setLive] = useState<ChatMessage[]>([]);
  const scroll = useRef<ScrollView>(null);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    let socket: WebSocket | null = null;
    try {
      socket = new WebSocket(chatApi.socketUrl(params.rideId));
      socket.onmessage = (ev) => {
        try {
          const parsed = parseChat(JSON.parse(String(ev.data)), myId);
          if (parsed.messages.length) setLive((l) => [...l, ...parsed.messages]);
        } catch {
          /* non-JSON frame */
        }
      };
      ws.current = socket;
    } catch {
      socket = null;
    }
    return () => {
      socket?.close();
      ws.current = null;
    };
  }, [params.rideId, myId]);

  const send = useMutation({
    mutationFn: async (text: string) => {
      const s = ws.current;
      if (s && s.readyState === WebSocket.OPEN) {
        s.send(JSON.stringify({ message: text }));
        return;
      }
      await chatApi.send(params.rideId, text);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['chat', params.rideId] }),
  });

  const seen = new Set<string>();
  const messages = [...(history.data?.messages ?? []), ...live].filter((m) => {
    const key = `${m.id}|${m.text}|${m.sentAt ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  useEffect(() => {
    scroll.current?.scrollToEnd({ animated: true });
  }, [messages.length]);
  const closed = history.data ? !history.data.open : false;

  return (
    <Screen
      testID="trip-chat"
      scroll={false}
      topBar={{ title: params.title ?? 'Trip chat' }}
      contentStyle={styles.content}
      footer={
        <Composer
          placeholder="Message"
          onSend={(t) => send.mutate(t)}
          disabled={closed}
          sending={send.isPending}
        />
      }
    >
      {params.subtitle ? (
        <Text style={[shared.subtitle, styles.center]}>{params.subtitle}</Text>
      ) : null}
      <Text style={[shared.small, styles.center]}>{history.data?.notice ?? RETENTION_LINE}</Text>
      {send.isError ? <Banner tone="error" message={toApiError(send.error).message} /> : null}
      {history.isError ? <Banner tone="error" message={toApiError(history.error).message} /> : null}
      {closed && history.data?.message ? <Banner message={history.data.message} /> : null}
      <ScrollView
        ref={scroll}
        style={styles.flex}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {history.isPending ? <ActivityIndicator color={colors.brand} /> : null}
        {messages.length === 0 && !history.isPending ? (
          <Text style={[shared.subtitle, styles.center]}>No messages yet. Say hello.</Text>
        ) : null}
        {messages.map((m) => (
          <Bubble key={`${m.id}-${m.sentAt ?? ''}`} m={m} />
        ))}
      </ScrollView>
    </Screen>
  );
}

const TUNDE_CHIPS = ['Cancel a booking', 'Refunds', 'Boarding code', 'Talk to a person'];

/** T1 · Chat with Tunde: support assistant, typing delay at 40 wpm, 3–60 s. */
export function TundeChatScreen() {
  const [turns, setTurns] = useState<TundeTurn[]>([
    { role: 'assistant', content: 'Hello! How can I help?' },
  ]);
  const [typing, setTyping] = useState(false);
  const [limited, setLimited] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);

  const ask = useMutation({
    mutationFn: async (message: string) => {
      const next = [...turns, { role: 'user' as const, content: message }];
      setTurns(next);
      setTyping(true);
      const k = 'sr2go.tunde.visitor';
      let visitor = await secureStorage.get(k);
      if (!visitor) {
        visitor = Crypto.randomUUID();
        await secureStorage.set(k, visitor);
      }
      const started = Date.now();
      const reply = await tundeApi.chat(message, turns, visitor);
      const words = reply.split(/\s+/).filter(Boolean).length;
      const wait =
        Math.min(60_000, Math.max(3_000, (words / 40) * 60_000)) - (Date.now() - started);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      return reply;
    },
    onSuccess: (reply) => {
      setTyping(false);
      setTurns((t) => [
        ...t,
        { role: 'assistant', content: reply || 'Sorry, I could not answer that. Try again.' },
      ]);
    },
    onError: (e) => {
      setTyping(false);
      const err = toApiError(e);
      if (err.status === 429) setLimited(err.message);
      else setTurns((t) => [...t, { role: 'assistant', content: err.message }]);
    },
  });

  useEffect(() => {
    scroll.current?.scrollToEnd({ animated: true });
  }, [turns.length, typing]);

  return (
    <Screen
      testID="tunde-chat"
      scroll={false}
      topBar={{ title: 'Tunde' }}
      contentStyle={styles.content}
      footer={
        <>
          {!limited ? (
            <View style={styles.chips}>
              {TUNDE_CHIPS.map((c) => (
                <Chip key={c} label={c} tone="grey" onPress={() => ask.mutate(c)} />
              ))}
            </View>
          ) : null}
          <Composer
            placeholder="Message Tunde"
            onSend={(t) => ask.mutate(t)}
            disabled={!!limited || ask.isPending}
          />
        </>
      }
    >
      <View style={styles.tundeHeader}>
        <Avatar name="T" size={36} />
        <Text style={shared.subtitle}>SR2Go support assistant</Text>
      </View>
      <Text style={[shared.small, styles.center]}>
        Tunde answers general questions. For anything about a trip in progress, use the SOS button
        or call SR2Go support.
      </Text>
      <ScrollView
        ref={scroll}
        style={styles.flex}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {turns.map((t, i) => (
          <Bubble
            key={i}
            m={{
              id: String(i),
              senderId: null,
              senderName: null,
              senderRole: null,
              text: t.content,
              sentAt: null,
              mine: t.role === 'user',
            }}
          />
        ))}
        {typing ? (
          <View style={[styles.bubble, styles.bubbleTheirs, styles.typing]}>
            <Text style={styles.dots}>•••</Text>
          </View>
        ) : null}
        {limited ? (
          <View style={styles.tile}>
            <Text style={styles.body}>{limited}</Text>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flex: 1, gap: spacing.xs, paddingBottom: 0 },
  center: { textAlign: 'center' },
  list: { gap: spacing.xs, paddingVertical: spacing.sm },
  bubbleWrap: { alignItems: 'flex-start', maxWidth: '85%' },
  bubbleWrapMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  sender: { ...typography.label, color: colors.textMuted, marginLeft: spacing.xs },
  bubble: { borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  bubbleTheirs: { backgroundColor: colors.tile },
  bubbleMine: { backgroundColor: colors.brand },
  bubbleText: { ...typography.body, color: colors.text },
  bubbleTextMine: { color: colors.textOnBrand },
  typing: { alignSelf: 'flex-start' },
  dots: { fontFamily: fonts.bold, fontSize: 18, color: colors.textMuted, letterSpacing: 2 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs },
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  tundeHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tile: { backgroundColor: colors.tile, borderRadius: radius.md, padding: spacing.md },
  body: { ...typography.body, color: colors.text },
});
