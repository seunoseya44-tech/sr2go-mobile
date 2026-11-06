import { useEffect, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { MapMarker, Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

import { colors, radius } from '../theme';

interface Props {
  /** The car's last reported position. */
  car: { lat: number; lng: number };
  /** The agreed meeting point, when the booking carries one. */
  meetingPoint?: { lat: number; lng: number; name?: string | null } | null;
  height?: number;
  /** Road line from GET /api/rides/{id}/route. */
  line?: { latitude: number; longitude: number }[] | null;
}

/**
 * Live tracking map (Maps SDK for Android, key restricted to the app). Shows the car
 * and the meeting point; re-centres as GPS points arrive. Google is only used to draw
 * the map: place search stays on SR2Go's own /api/places.
 */
export function TrackingMap({ car, meetingPoint, height = 220, line }: Props) {
  const ref = useRef<MapView | null>(null);
  const carRef = useRef<MapMarker | null>(null);
  const fitted = useRef(false);
  const mpLat = meetingPoint?.lat;
  const mpLng = meetingPoint?.lng;
  // Server release 128 (6 Nov): new positions arrive every few seconds - the car glides to each one (Android)
  // and the camera follows it instead of jumping; the first position frames the car and the meeting point.
  useEffect(() => {
    if (!fitted.current) return;
    const to = { latitude: car.lat, longitude: car.lng };
    if (Platform.OS === 'android') carRef.current?.animateMarkerToCoordinate(to, 2500);
    ref.current?.animateCamera({ center: to }, { duration: 2500 });
  }, [car.lat, car.lng]);
  useEffect(() => {
    if (fitted.current) return;
    fitted.current = true;
    const points = [
      { latitude: car.lat, longitude: car.lng },
      ...(mpLat != null && mpLng != null ? [{ latitude: mpLat, longitude: mpLng }] : []),
    ];
    if (points.length > 1) {
      ref.current?.fitToCoordinates(points, {
        edgePadding: { top: 48, right: 48, bottom: 48, left: 48 },
        animated: true,
      });
    } else {
      ref.current?.animateCamera({ center: points[0], zoom: 14 }, { duration: 600 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mpLat, mpLng]);

  return (
    <View style={[styles.wrap, { height }]} accessibilityLabel="Live map of the car's position">
      <MapView
        ref={ref}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: car.lat,
          longitude: car.lng,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        toolbarEnabled={false}
        showsCompass={false}
        pitchEnabled={false}
        rotateEnabled={false}
      >
        {line && line.length > 1 ? (
          <Polyline coordinates={line} strokeColor={colors.brand} strokeWidth={4} />
        ) : null}
        <Marker
          ref={carRef}
          coordinate={{ latitude: car.lat, longitude: car.lng }}
          title="Your ride"
          description="Moves as the driver's phone sends its position"
          pinColor={colors.navy}
        />
        {meetingPoint ? (
          <Marker
            coordinate={{ latitude: meetingPoint.lat, longitude: meetingPoint.lng }}
            title={meetingPoint.name ?? 'Meeting point'}
            pinColor={colors.brand}
          />
        ) : null}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', borderRadius: radius.lg, overflow: 'hidden' },
  map: { width: '100%', height: '100%' },
});
