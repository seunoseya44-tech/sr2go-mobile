import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import * as FS from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { http } from '../api/client';
import { toApiError } from '../api/errors';
import { session } from '../auth/session';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { env } from '../config/env';
import type { AppStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme';

/**
 * Journey card (release 108) and trip receipt (Step C) on the SR2Go
 * letterhead. The page is fetched with the user's token and shown in a web
 * view, so the token never appears in a URL. Receipts also offer the PDF
 * (download and share) and "Email me the receipt".
 */
export function DocumentScreen() {
  const { params } = useRoute<RouteProp<AppStackParamList, 'Document'>>();
  const [note, setNote] = useState<string | null>(null);

  const doc = useQuery({
    queryKey: ['document', params.path],
    queryFn: async () => {
      const res = await http.get<string>(params.path, {
        responseType: 'text',
        transformResponse: (d: unknown) => d,
        headers: { Accept: 'text/html, application/json' },
      });
      return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    },
    retry: false,
  });

  const pdf = useMutation({
    mutationFn: async () => {
      const token = session.getTokens()?.accessToken ?? '';
      const target = `${FS.cacheDirectory ?? ''}${params.pdfName ?? 'SR2Go-receipt'}.pdf`;
      const res = await FS.downloadAsync(`${env.apiBaseUrl}${params.pdfPath!}`, target, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status !== 200) throw new Error('The PDF could not be downloaded. Please try again.');
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(res.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      }
    },
    onError: (e) => setNote(toApiError(e).message),
  });

  const email = useMutation({
    mutationFn: async () => {
      const { data } = await http.post(params.emailPath!);
      const m = (data as { message?: unknown } | null)?.message;
      return typeof m === 'string' ? m : 'The receipt is on its way to your email.';
    },
    onSuccess: setNote,
    onError: (e) => setNote(toApiError(e).message),
  });

  const body = doc.data ?? '';
  const isHtml = /^\s*</.test(body);

  return (
    <Screen
      testID="document"
      topBar={{ title: params.title }}
      scroll={!isHtml}
      footer={
        params.pdfPath || params.emailPath ? (
          <View style={styles.row}>
            {params.pdfPath ? (
              <Button
                title="Download PDF"
                variant="secondary"
                icon="download-outline"
                onPress={() => pdf.mutate()}
                loading={pdf.isPending}
                style={styles.flex}
              />
            ) : null}
            {params.emailPath ? (
              <Button
                title="Email it to me"
                variant="secondary"
                icon="mail-outline"
                onPress={() => email.mutate()}
                loading={email.isPending}
                style={styles.flex}
              />
            ) : null}
          </View>
        ) : undefined
      }
    >
      {note ? <Banner tone="info" message={note} /> : null}
      {doc.isPending ? <ActivityIndicator color={colors.brand} /> : null}
      {doc.isError ? <Banner tone="error" message={toApiError(doc.error).message} /> : null}
      {doc.data && isHtml ? (
        <WebView
          style={styles.web}
          originWhitelist={['*']}
          source={{ html: body, baseUrl: env.apiBaseUrl }}
          setSupportMultipleWindows={false}
        />
      ) : doc.data ? (
        <JsonDocument text={body} />
      ) : null}
    </Screen>
  );
}

/** A receipt that comes back as JSON: label / value lines, nested objects flattened. */
function JsonDocument({ text }: { text: string }) {
  let rows: [string, string][] = [];
  try {
    const walk = (o: unknown, prefix = ''): [string, string][] =>
      o && typeof o === 'object' && !Array.isArray(o)
        ? Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
            v && typeof v === 'object' && !Array.isArray(v)
              ? walk(v, `${prefix}${k} · `)
              : v == null || Array.isArray(v)
                ? []
                : [[`${prefix}${k}`.replace(/_/g, ' '), String(v)] as [string, string]],
          )
        : [];
    rows = walk(JSON.parse(text));
  } catch {
    rows = [];
  }
  if (!rows.length) return <Text style={styles.value}>{text}</Text>;
  return (
    <View style={styles.list}>
      {rows.map(([k, v]) => (
        <View key={k} style={styles.line}>
          <Text style={styles.key}>{k}</Text>
          <Text style={styles.value}>{v}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.sm },
  web: { flex: 1, minHeight: 480, backgroundColor: colors.surface },
  list: { gap: spacing.sm },
  line: { gap: 2 },
  key: { ...typography.label, color: colors.textMuted, textTransform: 'capitalize' },
  value: { ...typography.body, color: colors.text },
});
