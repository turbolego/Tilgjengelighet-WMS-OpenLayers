import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MapColors, MapTheme } from '@/constants/map-theme';
import { esc, filterFullyAccessible } from '@/utils/map-api';

export interface HighscoreFeature {
  props: Map<string, string>;
  centerX: number;
  centerY: number;
}

export interface HighscoreModalProps {
  visible: boolean;
  onClose: () => void;
  loading?: boolean;
  features?: HighscoreFeature[];
  onZoomTo: (x: number, y: number) => void;
}

export function HighscoreModal({
  visible,
  onClose,
  loading = false,
  features = [],
  onZoomTo,
}: HighscoreModalProps) {
  let accessible: HighscoreFeature[] = [];
  try {
    accessible = filterFullyAccessible(features);
  } catch {
    accessible = [];
  }

  const renderContent = () => {
    if (loading) {
      return (
        <View>
          <Text style={styles.intro}>
            Skanner kartvisningen for veier som er tilgjengelige for alle
            (manuell rullestol, elektrisk rullestol, el-rullestol og
            synshemmede).
          </Text>
          <View style={styles.loadingRow}>
            <Text style={styles.loadingText}>
              Skanner kartområdet… dette kan ta noen sekunder.
            </Text>
          </View>
        </View>
      );
    }

    if (accessible.length === 0) {
      return (
        <View>
          <Text style={styles.intro}>
            Skanner kartvisningen for veier som er tilgjengelige for alle
            (manuell rullestol, elektrisk rullestol, el-rullestol og
            synshemmede).
          </Text>
          <Text style={styles.emptyText}>
            Ingen universelt tilgjengelige veier funnet i dette kartområdet.
            Prøv å zoome inn på et område med turveier.
          </Text>
          <Text style={[styles.emptyText, { marginTop: 8 }]}>
            Tips: Zoom inn på byer/tettsteder for å finne kartlagte turstier.
          </Text>
        </View>
      );
    }

    // Compute stats
    const totalSegmentLength = accessible.reduce((sum: number, f: any) => {
      const len = parseFloat(f.props.get('segmentlengde') || '0');
      return sum + (isNaN(len) ? 0 : len);
    }, 0);

    const avgStigning =
      accessible.reduce((sum: number, f: any) => {
        const s = parseFloat(f.props.get('stigning') || '0');
        return sum + (isNaN(s) ? 0 : s);
      }, 0) / accessible.length;

    // Rankings
    const byLength = [...accessible]
      .map((f) => ({
        ...f,
        segmentlengde: parseFloat(f.props.get('segmentlengde') || '0'),
      }))
      .filter((f) => !isNaN(f.segmentlengde) && f.segmentlengde > 0)
      .sort((a, b) => b.segmentlengde - a.segmentlengde)
      .slice(0, 10);

    const bySteepness = [...accessible]
      .map((f) => ({
        ...f,
        stigning: parseFloat(f.props.get('stigning') || '0'),
      }))
      .filter((f) => !isNaN(f.stigning) && f.stigning > 0)
      .sort((a, b) => b.stigning - a.stigning)
      .slice(0, 10);

    const byWidth = [...accessible]
      .map((f) => ({
        ...f,
        bredde: parseFloat(f.props.get('bredde') || '0'),
      }))
      .filter((f) => !isNaN(f.bredde) && f.bredde > 0)
      .sort((a, b) => b.bredde - a.bredde)
      .slice(0, 10);

    const byFlattest = [...accessible]
      .map((f) => ({
        ...f,
        stigning: parseFloat(f.props.get('stigning') || '0'),
      }))
      .filter((f) => !isNaN(f.stigning) && f.stigning >= 0)
      .sort((a, b) => a.stigning - b.stigning)
      .slice(0, 10);

    return (
      <View>
        <Text style={styles.intro}>
          Veier tilgjengelige for alle i gjeldende kartvisning (manuell
          rullestol, elektrisk rullestol, el-rullestol og synshemmede).
        </Text>

        {/* Stats cards */}
        <View style={styles.statsRow}>
          <StatCard value={String(accessible.length)} label="Segmenter funnet" />
          <StatCard
            value={`${(totalSegmentLength / 1000).toFixed(2)} km`}
            label="Total lengde"
          />
          <StatCard
            value={`${avgStigning.toFixed(1)}%`}
            label="Snitt stigning"
          />
        </View>

        {/* Longest */}
        {byLength.length > 0 && (
          <HighscoreSection
            title="🏅 Lengste tilgjengelige veier"
            columns={['#', 'Veitype', 'Lengde', 'Stigning', 'Kommune']}
            rows={byLength.map((f, i) => ({
              rank: String(i + 1),
              cells: [
                esc(f.props.get('veitype') || '—'),
                `${f.segmentlengde.toFixed(1)} m`,
                `${f.props.get('stigning') || '—'}%`,
                esc(f.props.get('kommune') || '—'),
              ],
              onZoom: () => onZoomTo(f.centerX, f.centerY),
            }))}
          />
        )}

        {/* Steepest */}
        {bySteepness.length > 0 && (
          <HighscoreSection
            title="⛰️ Bratteste tilgjengelige veier"
            columns={['#', 'Veitype', 'Stigning', 'Lengde', 'Kommune']}
            rows={bySteepness.map((f, i) => ({
              rank: String(i + 1),
              cells: [
                esc(f.props.get('veitype') || '—'),
                `${f.stigning.toFixed(1)}%`,
                `${f.props.get('segmentlengde') || '—'} m`,
                esc(f.props.get('kommune') || '—'),
              ],
              onZoom: () => onZoomTo(f.centerX, f.centerY),
            }))}
          />
        )}

        {/* Widest */}
        {byWidth.length > 0 && (
          <HighscoreSection
            title="↔️ Bredeste tilgjengelige veier"
            columns={['#', 'Veitype', 'Bredde', 'Lengde', 'Kommune']}
            rows={byWidth.map((f, i) => ({
              rank: String(i + 1),
              cells: [
                esc(f.props.get('veitype') || '—'),
                `${f.bredde.toFixed(0)} cm`,
                `${f.props.get('segmentlengde') || '—'} m`,
                esc(f.props.get('kommune') || '—'),
              ],
              onZoom: () => onZoomTo(f.centerX, f.centerY),
            }))}
          />
        )}

        {/* Flattest */}
        {byFlattest.length > 0 && (
          <HighscoreSection
            title="🛤️ Flateste tilgjengelige veier"
            columns={['#', 'Veitype', 'Stigning', 'Lengde', 'Kommune']}
            rows={byFlattest.map((f, i) => ({
              rank: String(i + 1),
              cells: [
                esc(f.props.get('veitype') || '—'),
                `${f.stigning.toFixed(1)}%`,
                `${f.props.get('segmentlengde') || '—'} m`,
                esc(f.props.get('kommune') || '—'),
              ],
              onZoom: () => onZoomTo(f.centerX, f.centerY),
            }))}
          />
        )}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Lukk toppliste" accessibilityHint="Trykk for å lukke">
        <View />
      </Pressable>
      <View style={styles.panel}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            🏆 Toppliste – Universelt tilgjengelige veier
          </Text>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.closeButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Lukk toppliste"
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scrollBody}
          contentContainerStyle={styles.scrollContent}
        >
          {renderContent()}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Stat card ───────────────────────────────────────────────────────────────

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statCard} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ── Highscore section (table) ───────────────────────────────────────────────

function HighscoreSection({
  title,
  columns,
  rows,
}: {
  title: string;
  columns: string[];
  rows: { rank: string; cells: string[]; onZoom: () => void }[];
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>

      {/* Table header */}
      <View style={styles.tableHeader}>
        {columns.map((col, ci) => (
          <Text key={ci} style={[styles.tableHeaderCell, ci === 0 && styles.rankCol]}>
            {col}
          </Text>
        ))}
        <View style={styles.zoomHeaderCol} />
      </View>

      {/* Table rows */}
      {rows.map((row, ri) => (
        <View key={ri} style={styles.tableRow} accessible accessibilityLabel={`${row.rank}. ${row.cells.slice(0, -1).join(', ')}`}>
          <Text style={[styles.rankCell, styles.rankCol]}>{row.rank}</Text>
          {row.cells.map((cell, ci) => (
            <Text key={ci} style={styles.cell} numberOfLines={1}>
              {cell}
            </Text>
          ))}
          <Pressable
            onPress={() => row.onZoom()}
            style={({ pressed }) => [
              styles.zoomButton,
              pressed && styles.zoomButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Zoom til ${row.cells[0] || 'sted'}`}
          >
            <Text style={styles.zoomButtonText}>Zoom</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: MapColors.backdrop,
  },
  panel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '92%',
    maxWidth: 600,
    maxHeight: '90%',
    backgroundColor: MapColors.surface,
    borderWidth: 1,
    borderColor: MapColors.border,
    borderRadius: 14,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(58,80,104,0.5)',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: MapColors.whiteText,
    flex: 1,
    marginRight: 8,
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: MapColors.border,
    borderRadius: 8,
  },
  closeButtonPressed: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  closeButtonText: {
    fontSize: 14,
    color: MapColors.mutedText,
  },
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 24,
  },
  intro: {
    fontSize: 13,
    color: MapColors.mutedText,
    lineHeight: 20,
    marginBottom: 16,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  loadingText: {
    fontSize: 13,
    color: MapColors.mutedText,
  },
  emptyText: {
    fontSize: 13,
    color: MapColors.mutedText,
    fontStyle: 'italic',
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    minWidth: 120,
    backgroundColor: 'rgba(13,17,23,0.5)',
    borderWidth: 1,
    borderColor: MapColors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 21,
    fontWeight: '700',
    color: MapColors.accent,
  },
  statLabel: {
    fontSize: 10,
    color: MapColors.mutedText,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: MapColors.headingText,
    marginBottom: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: MapColors.divider,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tableHeaderCell: {
    fontSize: 10,
    fontWeight: '500',
    color: MapColors.mutedText,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  rankCol: {
    width: 24,
    flex: 0,
  },
  zoomHeaderCol: {
    width: 52,
    flex: 0,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: MapColors.divider,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  rankCell: {
    fontSize: 12,
    fontWeight: '700',
    color: MapColors.accent,
  },
  cell: {
    fontSize: 12,
    color: MapColors.bodyText,
    flex: 1,
  },
  zoomButton: {
    backgroundColor: MapColors.accent,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    width: 52,
    alignItems: 'center',
  },
  zoomButtonPressed: {
    backgroundColor: MapColors.accentHover,
  },
  zoomButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: MapTheme.ink,
  },
});
