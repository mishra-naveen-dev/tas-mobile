import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, PermissionsAndroid, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {
  useSound,
  AudioEncoderAndroidType,
  AudioSourceAndroidType,
  OutputFormatAndroidType,
} from 'react-native-nitro-sound';
import { colors, typography, spacing, borderRadius } from '../theme/tokens';

// Mirrors the server's hard cap (CompleteVisitSerializer.audio_duration_seconds,
// tas-backend/apps/loans/serializers.py) — auto-stops instead of letting the
// officer record something the upload will then be rejected for.
const MAX_DURATION_MS = 120000;

const ANDROID_AUDIO_SET = {
  AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
  AudioSourceAndroid: AudioSourceAndroidType.MIC,
  OutputFormatAndroid: OutputFormatAndroidType.MPEG_4,
  AudioSamplingRate: 44100,
  AudioEncodingBitRate: 128000,
  AudioChannels: 1,
};

async function ensureMicPermission() {
  if (Platform.OS !== 'android') return true;
  const already = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  if (already) return true;
  const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
    title: 'Microphone Permission',
    message: 'TAS needs microphone access to record a voice note during this visit.',
    buttonNeutral: 'Ask Later',
    buttonNegative: 'Cancel',
    buttonPositive: 'OK',
  });
  return res === PermissionsAndroid.RESULTS.GRANTED;
}

const fileNameFromUri = (uri) => uri.split('/').pop() || `voice_note_${Date.now()}.m4a`;
const mimeTypeFor = (fileName) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  return { m4a: 'audio/m4a', mp4: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', '3gp': 'audio/3gpp' }[ext] || 'audio/mp4';
};

/**
 * Record / preview-playback / re-record a short voice note for a Collection
 * Visit. Controlled component: `value` is `{ uri, fileName, mimeType,
 * durationSeconds } | null`, `onChange(next)` reports every change (a fresh
 * recording, or `null` after Remove) back to the parent screen, which owns
 * whether one is actually required for the current visit outcome.
 */
const VoiceNoteRecorder = ({ value, onChange, required }) => {
  const {
    state, startRecorder, stopRecorder, startPlayer, stopPlayer, pausePlayer, resumePlayer, mmssss,
  } = useSound({ subscriptionDuration: 0.1 });

  const autoStopGuardRef = useRef(false);
  const lastPositionRef = useRef(0);

  useEffect(() => {
    lastPositionRef.current = state.currentPosition;
    if (state.isRecording && state.currentPosition >= MAX_DURATION_MS && !autoStopGuardRef.current) {
      autoStopGuardRef.current = true;
      handleStop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isRecording, state.currentPosition]);

  useEffect(() => () => {
    // Leaving the screen mid-recording/playback shouldn't leak a native session.
    if (state.isRecording) stopRecorder().catch(() => {});
    if (state.isPlaying) stopPlayer().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStart = async () => {
    const granted = await ensureMicPermission();
    if (!granted) {
      Alert.alert('Microphone Needed', 'Please allow microphone access to record a voice note.');
      return;
    }
    try {
      autoStopGuardRef.current = false;
      await startRecorder(undefined, Platform.OS === 'android' ? ANDROID_AUDIO_SET : undefined, false);
    } catch (e) {
      Alert.alert('Recording Failed', e?.message || 'Could not start recording.');
    }
  };

  const handleStop = async () => {
    try {
      const uri = await stopRecorder();
      const durationSeconds = Math.min(120, Math.round(lastPositionRef.current / 1000));
      const fileName = fileNameFromUri(uri);
      onChange({ uri, fileName, mimeType: mimeTypeFor(fileName), durationSeconds });
    } catch (e) {
      Alert.alert('Recording Failed', e?.message || 'Could not save the recording.');
    }
  };

  const handlePlayPause = async () => {
    if (!value?.uri) return;
    if (state.isPlaying) {
      await pausePlayer();
      return;
    }
    if (state.currentPosition > 0 && state.currentPosition < state.duration) {
      await resumePlayer();
    } else {
      await startPlayer(value.uri);
    }
  };

  const handleRemove = () => {
    if (state.isPlaying) stopPlayer().catch(() => {});
    onChange(null);
  };

  if (state.isRecording) {
    return (
      <View style={styles.card}>
        <View style={styles.recordingRow}>
          <View style={styles.recDot} />
          <Text style={styles.recordingText}>Recording... {mmssss(Math.floor(state.currentPosition))}</Text>
        </View>
        <TouchableOpacity style={styles.stopBtn} onPress={handleStop}>
          <Icon name="square" size={16} color="#fff" />
          <Text style={styles.stopBtnText}>Stop</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (value?.uri) {
    return (
      <View style={styles.card}>
        <TouchableOpacity style={styles.playBtn} onPress={handlePlayPause}>
          <Icon name={state.isPlaying ? 'pause' : 'play'} size={16} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.durationText}>
          {mmssss(Math.floor(state.isPlaying || state.currentPosition > 0 ? state.currentPosition : 0))} / 0:{String(value.durationSeconds).padStart(2, '0')}
        </Text>
        <TouchableOpacity style={styles.reRecordBtn} onPress={handleStart}>
          <Icon name="mic" size={14} color={colors.textMuted} />
          <Text style={styles.reRecordText}>Re-record</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.removeBtn} onPress={handleRemove}>
          <Icon name="trash-2" size={16} color={colors.danger} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity style={[styles.recordBtn, required && styles.recordBtnRequired]} onPress={handleStart}>
      <Icon name="mic" size={18} color={required ? colors.danger : colors.primary} />
      <Text style={[styles.recordBtnText, required && { color: colors.danger }]}>
        Record Voice Note{required ? ' *' : ' (Optional)'}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
  },
  recordBtnRequired: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerLight,
  },
  recordBtnText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.primary,
  },
  recordingRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
  },
  recordingText: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    fontWeight: typography.weights.medium,
  },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    backgroundColor: colors.danger,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.sm,
  },
  stopBtnText: {
    color: '#fff',
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.textMedium,
  },
  reRecordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reRecordText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  removeBtn: {
    padding: spacing.xxs,
  },
});

export default VoiceNoteRecorder;
