import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Keyboard,
  Dimensions,
  ActivityIndicator,
  useWindowDimensions,
  LayoutAnimation,
} from 'react-native';
import * as Location from 'expo-location';
import { normalizarCidade } from '../context/Normalizer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { useRouter } from 'expo-router';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSearchLocation } from '../context/SearchLocationContext';
import { useCrimeAnalysis } from '../hooks/useCrimeAnalysis';
import {
  getCrimeIcon,
  formatCrimeName,
  lifeCrimesKeys,
  physicalCrimesKeys,
  patrimonyCrimesKeys,
} from '../constants/CrimeData';
import { AnalysisResult, CrimeCategory } from '../services/analytics/types';
import CitySearchBar from '../components/analysis/CitySearchBar';
import { AnimatedBar, DonutChart, CompareRow, PositionGauge } from '../components/analysis/Charts';
import {
  fmtInt,
  fmtDec,
  fmtRate,
  fmtCompact,
  fmtPeriodLong,
  fmtPeriodShort,
  CATEGORY_META,
  CategoryKey,
  VERDICT_META,
  getVerdict,
} from '../components/analysis/format';

const SCREEN_WIDTH = Dimensions.get('window').width;
const MAIN_CATEGORIES: CrimeCategory[] = ['patrimony', 'physical', 'life'];

/* ================================================================== */
/* Blocos de layout                                                    */
/* ================================================================== */

function Card({
  title,
  subtitle,
  icon,
  delay = 0,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: string;
  delay?: number;
  children: React.ReactNode;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(450)} style={styles.card}>
      <View style={styles.cardHeader}>
        {icon ? (
          <View style={styles.cardIcon}>
            <FontAwesome6 name={icon as any} size={13} color="#1c1f75" />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{title}</Text>
          {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {children}
    </Animated.View>
  );
}

function SkeletonBlock({ height, style }: { height: number; style?: any }) {
  const opacity = useSharedValue(0.5);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [opacity]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[{ height, borderRadius: 24, backgroundColor: '#e2e8f0', marginBottom: 16 }, style, animated]} />;
}

function StateMessage({
  icon,
  title,
  text,
  action,
}: {
  icon: string;
  title: string;
  text: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <Animated.View entering={FadeInDown.duration(400)} style={styles.stateContainer}>
      <View style={styles.stateIcon}>
        <FontAwesome6 name={icon as any} size={30} color="#1c1f75" />
      </View>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateText}>{text}</Text>
      {action && (
        <TouchableOpacity style={styles.stateButton} onPress={action.onPress} activeOpacity={0.8}>
          <Text style={styles.stateButtonText}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

/* ================================================================== */
/* Seções da análise                                                   */
/* ================================================================== */

function Hero({ analysis }: { analysis: AnalysisResult }) {
  const { width: windowWidth } = useWindowDimensions();
  const [cardWidth, setCardWidth] = useState(windowWidth - 32);
  const { displayName, population, totalOccurrences, ratePer100k, benchmark, dataQuality } = analysis;
  const verdict = getVerdict(ratePer100k, benchmark?.stateRatePer100k);
  const v = verdict ? VERDICT_META[verdict.verdict] : null;

  const bgWidth = cardWidth > 0 ? cardWidth : windowWidth - 32;
  const bgHeight = Math.round((bgWidth * 1308) / 736);

  const isSmall = cardWidth < 360;

  return (
    <Animated.View entering={FadeInDown.duration(450)} style={styles.heroShadow}>
      <View
        style={styles.hero}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0 && Math.abs(w - cardWidth) > 1) {
            setCardWidth(w);
          }
        }}
      >
        {/* Imagem de fundo com base encostada na base do card e preenchimento total */}
        <View style={StyleSheet.absoluteFill}>
          <Image
            source={require('../../assets/images/bg_05.jpg')}
            style={[styles.heroBgImage, { width: bgWidth, height: bgHeight }]}
            resizeMode="cover"
          />
          {/* Degradê do transparente para o escuro (ainda parcialmente transparente) */}
          <LinearGradient
            colors={['rgba(3, 7, 26, 0.20)', 'rgba(8, 14, 46, 0.65)', 'rgba(2, 4, 18, 0.88)']}
            locations={[0, 0.45, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </View>

        {/* Conteúdo com padding interno */}
        <View style={[styles.heroContent, isSmall && styles.heroContentSmall]}>
          <View style={styles.heroChip}>
            <FontAwesome6 name="calendar" size={10} color="#e0e7ff" />
            <Text style={styles.heroChipText}>{fmtPeriodLong(dataQuality.lastPeriod)}</Text>
          </View>

          <Text style={styles.heroCity} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75}>
            {displayName ?? analysis.city}
          </Text>
          {population ? (
            <Text style={styles.heroPop}>
              <FontAwesome6 name="people-group" size={12} color="#c7d2fe" />  {fmtCompact(population)} de habitantes
            </Text>
          ) : null}

          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text
                style={styles.heroStatValue}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.65}
              >
                {fmtInt(totalOccurrences)}
              </Text>
              <Text
                style={styles.heroStatLabel}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                ocorrências{'\n'}no mês
              </Text>
            </View>
            {ratePer100k !== undefined && (
              <>
                <View style={[styles.heroDivider, isSmall && styles.heroDividerSmall]} />
                <View style={styles.heroStat}>
                  <Text
                    style={styles.heroStatValue}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.65}
                  >
                    {fmtRate(ratePer100k)}
                  </Text>
                  <Text
                    style={styles.heroStatLabel}
                    numberOfLines={2}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                  >
                    a cada 100 mil{'\n'}habitantes
                  </Text>
                </View>
              </>
            )}
          </View>

          {v && verdict && (
            <View style={styles.verdictPill}>
              <View style={[styles.verdictDot, { backgroundColor: v.bg }]}>
                <FontAwesome6 name={v.icon as any} size={10} color={v.color} />
              </View>
              <Text style={styles.verdictText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                {v.label}
              </Text>
              {verdict.verdict !== 'average' && (
                <Text style={styles.verdictPct}>
                  {verdict.diffPct > 0 ? '+' : '−'}
                  {fmtInt(Math.abs(verdict.diffPct))}%
                </Text>
              )}
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

function Summary({ analysis }: { analysis: AnalysisResult }) {
  const { categories, dominantCategory, dominantCrime, ratePer100k, benchmark } = analysis;
  const items: { icon: string; color: string; text: React.ReactNode }[] = [];

  const dominant = categories.find(c => c.id === dominantCategory);
  if (dominant && dominantCategory) {
    const inTen = Math.round(dominant.percentage / 10);
    if (inTen >= 1) {
      items.push({
        icon: CATEGORY_META[dominantCategory].icon,
        color: CATEGORY_META[dominantCategory].color,
        text: (
          <>
            <Text style={styles.bold}>{inTen} em cada 10</Text> registros são {CATEGORY_META[dominantCategory].plural}
          </>
        ),
      });
    }
  }

  if (dominantCrime) {
    const { icon, color } = getCrimeIcon(dominantCrime.name);
    items.push({
      icon,
      color,
      text: (
        <>
          Tipo mais registrado: <Text style={styles.bold}>{dominantCrime.name}</Text>
        </>
      ),
    });
  }

  const verdict = getVerdict(ratePer100k, benchmark?.stateRatePer100k);
  if (verdict) {
    const meta = VERDICT_META[verdict.verdict];
    items.push({
      icon: 'scale-balanced',
      color: meta.color,
      text:
        verdict.verdict === 'average' ? (
          <>Ocorrências por habitante <Text style={styles.bold}>parecidas com a média</Text> do estado</>
        ) : (
          <>
            <Text style={[styles.bold, { color: meta.color }]}>
              {fmtInt(Math.abs(verdict.diffPct))}% {verdict.diffPct < 0 ? 'menos' : 'mais'}
            </Text>{' '}
            ocorrências por habitante que a média de SP
          </>
        ),
    });
  }

  const life = categories.find(c => c.id === 'life');
  if (life) {
    items.push({
      icon: CATEGORY_META.life.icon,
      color: CATEGORY_META.life.color,
      text:
        life.total > 0 ? (
          <>
            <Text style={styles.bold}>{fmtInt(life.total)}</Text> {life.total === 1 ? 'crime' : 'crimes'} contra a vida no mês
          </>
        ) : (
          <>Nenhum crime contra a vida registrado no mês</>
        ),
    });
  }

  if (items.length === 0) return null;

  return (
    <Card
      title="Em resumo"
      subtitle="Principais destaques da região"
      delay={80}
    >
      <View style={{ gap: 12 }}>
        {items.map((item, i) => (
          <View key={i} style={styles.summaryRow}>
            <View style={[styles.summaryIcon, { backgroundColor: `${item.color}14` }]}>
              <FontAwesome6 name={item.icon as any} size={13} color={item.color} />
            </View>
            <Text style={styles.summaryText}>{item.text}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

function StatePosition({ analysis }: { analysis: AnalysisResult }) {
  const { benchmark, ratePer100k } = analysis;
  if (!benchmark?.stateRatePer100k || ratePer100k === undefined) return null;
  const max = Math.max(ratePer100k, benchmark.stateRatePer100k) * 1.1;

  return (
    <Card
      title="Comparado ao estado"
      subtitle="Ocorrências a cada 100 mil habitantes"
      icon="ranking-star"
      delay={160}
    >
      <CompareRow
        icon="chart-simple"
        label="Total de ocorrências"
        color="#3331ff"
        cityValue={ratePer100k}
        stateValue={benchmark.stateRatePer100k}
        max={max}
        format={fmtRate}
        cityLabel="Local"
        delay={200}
      />
      {benchmark.rateRank && (
        <View style={styles.gaugeSection}>
          <Text style={styles.gaugeTitle}>
            Menos ocorrências por habitante que{' '}
            <Text style={styles.bold}>{fmtInt(benchmark.rateRank.lowerThanPct)}%</Text> das cidades paulistas
          </Text>
          <PositionGauge position={benchmark.rateRank.position} outOf={benchmark.rateRank.outOf} />
        </View>
      )}
    </Card>
  );
}

function Breakdown({ analysis }: { analysis: AnalysisResult }) {
  const { categories, otherTotal = 0, totalOccurrences } = analysis;
  const entries: { key: CategoryKey; total: number; pct: number }[] = MAIN_CATEGORIES.map(id => {
    const c = categories.find(x => x.id === id);
    return { key: id, total: c?.total ?? 0, pct: c?.percentage ?? 0 };
  });
  if (otherTotal > 0) {
    entries.push({ key: 'other', total: otherTotal, pct: totalOccurrences > 0 ? (otherTotal / totalOccurrences) * 100 : 0 });
  }

  const donutSize = Math.round(Math.min(150, SCREEN_WIDTH * 0.36));

  return (
    <Card title="Tipos de ocorrência" subtitle="Como os registros se dividem" icon="chart-pie" delay={240}>
      <View style={styles.breakdownRow}>
        <DonutChart
          size={donutSize}
          segments={entries.map(e => ({ value: e.total, color: CATEGORY_META[e.key].color }))}
          centerValue={fmtInt(totalOccurrences)}
          centerLabel="registros"
        />
        <View style={styles.legend}>
          {entries.map(e => (
            <View key={e.key} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: CATEGORY_META[e.key].color }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.legendLabel} numberOfLines={1}>{CATEGORY_META[e.key].label}</Text>
                <Text style={styles.legendCount}>{fmtInt(e.total)} casos</Text>
              </View>
              <Text style={styles.legendPct}>{e.pct < 1 && e.pct > 0 ? '<1' : fmtInt(e.pct)}%</Text>
            </View>
          ))}
        </View>
      </View>
      {otherTotal > 0 && (
        <Text style={styles.footnote}>“Outros” inclui casos como tráfico, porte de arma e extorsão.</Text>
      )}
    </Card>
  );
}

function CategoryComparison({ analysis }: { analysis: AnalysisResult }) {
  const { benchmark, categories } = analysis;
  if (!benchmark) return null;
  const usesRates = !!(benchmark.cityCategoryRates && benchmark.stateCategoryRates);

  return (
    <Card
      title="Cidade × Estado por categoria"
      subtitle={usesRates ? 'Ocorrências a cada 100 mil habitantes' : 'Participação no total de registros'}
      icon="code-compare"
      delay={320}
    >
      <View style={{ gap: 20 }}>
        {MAIN_CATEGORIES.map((id, i) => {
          const cityValue = usesRates
            ? benchmark.cityCategoryRates![id]
            : categories.find(c => c.id === id)?.percentage ?? 0;
          const stateValue = usesRates ? benchmark.stateCategoryRates![id] : benchmark.stateCategoryShares[id];
          return (
            <CompareRow
              key={id}
              icon={CATEGORY_META[id].icon}
              label={CATEGORY_META[id].label}
              color={CATEGORY_META[id].color}
              cityValue={cityValue}
              stateValue={stateValue}
              max={Math.max(cityValue, stateValue) * 1.1}
              format={usesRates ? fmtRate : (n: number) => `${fmtDec(n, 1)}%`}
              cityLabel="Local"
              delay={350 + i * 120}
            />
          );
        })}
      </View>
    </Card>
  );
}

function TopCrimes({ analysis }: { analysis: AnalysisResult }) {
  const top = analysis.topCrimes ?? [];
  if (top.length === 0) return null;
  const max = top[0].total;

  return (
    <Card title="Ocorrências mais comuns" subtitle="Os 5 tipos mais registrados" icon="list-ol" delay={400}>
      <View style={{ gap: 14 }}>
        {top.map((item, i) => {
          const { icon, color } = getCrimeIcon(item.key);
          return (
            <View key={item.key} style={{ gap: 6 }}>
              <View style={styles.topRow}>
                <Text style={styles.topRank}>{i + 1}</Text>
                <View style={[styles.topIcon, { backgroundColor: `${color}14` }]}>
                  <FontAwesome6 name={icon as any} size={12} color={color} />
                </View>
                <Text style={styles.topName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.topCount}>{fmtInt(item.total)}</Text>
              </View>
              <View style={{ paddingLeft: 52 }}>
                <AnimatedBar pct={(item.total / max) * 100} color={i === 0 ? '#3331ff' : '#a5b4fc'} height={8} delay={450 + i * 90} />
              </View>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

function Trend({ analysis }: { analysis: AnalysisResult }) {
  const { trend, dataQuality } = analysis;
  if (!trend || !dataQuality.hasEnoughHistoryForTrend || trend.points.length < 2) return null;
  const change = trend.periodChange;

  return (
    <Card title="Evolução mês a mês" subtitle="Total de ocorrências registradas" icon="chart-line" delay={480}>
      <LineChart
        data={{
          labels: trend.points.map(p => fmtPeriodShort(p.month, p.year)),
          datasets: [{ data: trend.points.map(p => p.total), color: (o = 1) => `rgba(51, 49, 255, ${o})`, strokeWidth: 3 }],
        }}
        width={SCREEN_WIDTH - 72}
        height={190}
        withInnerLines={false}
        chartConfig={{
          backgroundGradientFrom: '#ffffff',
          backgroundGradientTo: '#ffffff',
          decimalPlaces: 0,
          color: (o = 1) => `rgba(51, 49, 255, ${o})`,
          labelColor: (o = 1) => `rgba(100, 116, 139, ${o})`,
          propsForDots: { r: '4', strokeWidth: '2', stroke: '#fff' },
        }}
        bezier
        style={{ marginLeft: -12 }}
      />
      {change && change.percentageChange !== null && (
        <View style={styles.trendPill}>
          <FontAwesome6
            name={change.absoluteChange > 0 ? 'arrow-trend-up' : change.absoluteChange < 0 ? 'arrow-trend-down' : 'minus'}
            size={13}
            color={change.absoluteChange > 0 ? '#dc2626' : change.absoluteChange < 0 ? '#16a34a' : '#64748b'}
          />
          <Text style={styles.trendText}>
            {change.absoluteChange > 0 ? '+' : ''}
            {fmtDec(change.percentageChange, 1)}% em relação ao mês anterior
          </Text>
        </View>
      )}
    </Card>
  );
}

function VigiaCta({ analysis }: { analysis: AnalysisResult }) {
  const router = useRouter();
  const targetCity = analysis.displayName ?? analysis.city ?? 'sua região';

  return (
    <Animated.View entering={FadeInDown.delay(520).duration(450)} style={styles.ctaCard}>
      <View style={styles.ctaIcon}>
        <FontAwesome6 name="eye" size={18} color="#3331ff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.ctaTitle} numberOfLines={2}>Fique de olho em {targetCity}</Text>
        <Text style={styles.ctaText}>Crie um Vigia e receba alertas de novos relatos.</Text>
      </View>
      <TouchableOpacity
        style={styles.ctaButton}
        activeOpacity={0.85}
        onPress={() => router.push({ pathname: '/home', params: { switchTab: 'locais' } })}
      >
        <FontAwesome6 name="arrow-right" size={14} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );
}

/* ================================================================== */
/* Filtro de Crimes e Visão de Crime Específico                        */
/* ================================================================== */

type FilterSelection =
  | { type: 'general' }
  | { type: 'specific'; category: CrimeCategory; crimeKey: string };

const NATURE_LIST: { id: CrimeCategory; label: string; icon: string; color: string; keys: string[] }[] = [
  { id: 'patrimony', label: 'Patrimônio', icon: 'building-shield', color: '#64748b', keys: patrimonyCrimesKeys },
  { id: 'physical', label: 'Integridade Física', icon: 'person-falling-burst', color: '#dc2626', keys: physicalCrimesKeys },
  { id: 'life', label: 'Contra a Vida', icon: 'skull-crossbones', color: '#000000', keys: lifeCrimesKeys },
];

function CrimeFilterCard({
  selectedFilter,
  onSelectFilter,
  rawCrimes,
}: {
  selectedFilter: FilterSelection;
  onSelectFilter: (filter: FilterSelection) => void;
  rawCrimes?: Record<string, number>;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeCategoryTab, setActiveCategoryTab] = useState<CrimeCategory>(
    selectedFilter.type === 'specific' ? selectedFilter.category : 'patrimony'
  );

  const currentCategoryObj = selectedFilter.type === 'specific'
    ? NATURE_LIST.find(n => n.id === selectedFilter.category)
    : null;

  const currentIcon = selectedFilter.type === 'general'
    ? { icon: 'layer-group', color: '#1c1f75' }
    : getCrimeIcon(selectedFilter.crimeKey);

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(prev => !prev);
  };

  const handleSelectGeneral = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onSelectFilter({ type: 'general' });
    setIsExpanded(false);
  };

  const handleSelectCrime = (category: CrimeCategory, crimeKey: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onSelectFilter({ type: 'specific', category, crimeKey });
    setIsExpanded(false);
  };

  return (
    <Animated.View entering={FadeInDown.duration(400)} style={styles.filterCardShadow}>
      <View style={styles.filterCard}>
        {/* Cabeçalho do Card longo horizontal */}
        <TouchableOpacity
          style={styles.filterCardHeader}
          onPress={toggleExpand}
          activeOpacity={0.8}
        >
          <View style={[styles.filterIconCircle, { backgroundColor: selectedFilter.type === 'general' ? '#e0e7ff' : `${currentIcon.color}15` }]}>
            <FontAwesome6 name={currentIcon.icon as any} size={15} color={currentIcon.color} />
          </View>

          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.filterEyebrow}>
              {selectedFilter.type === 'general' ? 'Filtro de ocorrências' : `Filtrado por: ${currentCategoryObj?.label}`}
            </Text>
            <Text style={styles.filterCurrentTitle} numberOfLines={1}>
              {selectedFilter.type === 'general' ? 'Visão Geral (Todas)' : formatCrimeName(selectedFilter.crimeKey)}
            </Text>
          </View>

          <View style={styles.filterHeaderActions}>
            {selectedFilter.type === 'specific' && (
              <TouchableOpacity
                style={styles.filterClearBtn}
                onPress={(e) => {
                  e.stopPropagation();
                  handleSelectGeneral();
                }}
                activeOpacity={0.7}
              >
                <FontAwesome6 name="arrow-rotate-left" size={10} color="#3331ff" style={{ marginRight: 4 }} />
                <Text style={styles.filterClearText}>Geral</Text>
              </TouchableOpacity>
            )}
            <View style={[styles.filterChevronCircle, isExpanded && styles.filterChevronRotated]}>
              <FontAwesome6 name={isExpanded ? 'chevron-up' : 'chevron-down'} size={12} color="#475569" />
            </View>
          </View>
        </TouchableOpacity>

        {/* Área expandida de seleção */}
        {isExpanded && (
          <View style={styles.filterExpandArea}>
            <View style={styles.filterDivider} />

            {/* Abas de Natureza + Visão Geral */}
            <Text style={styles.filterSectionTitle}>Escolha a natureza ou volte à visão geral:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterTabsRow}>
              <TouchableOpacity
                style={[styles.filterTabPill, selectedFilter.type === 'general' && styles.filterTabPillActive]}
                onPress={handleSelectGeneral}
                activeOpacity={0.75}
              >
                <FontAwesome6 name="layer-group" size={12} color={selectedFilter.type === 'general' ? '#fff' : '#1c1f75'} />
                <Text style={[styles.filterTabPillText, selectedFilter.type === 'general' && styles.filterTabPillTextActive]}>
                  Visão Geral
                </Text>
              </TouchableOpacity>

              {NATURE_LIST.map(nature => {
                const isSelected = selectedFilter.type === 'specific' && selectedFilter.category === nature.id;
                const isBrowsed = activeCategoryTab === nature.id;
                return (
                  <TouchableOpacity
                    key={nature.id}
                    style={[
                      styles.filterTabPill,
                      isBrowsed && { borderColor: nature.color, backgroundColor: `${nature.color}12` },
                      isSelected && { backgroundColor: nature.color }
                    ]}
                    onPress={() => {
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      setActiveCategoryTab(nature.id);
                    }}
                    activeOpacity={0.75}
                  >
                    <FontAwesome6
                      name={nature.icon as any}
                      size={12}
                      color={isSelected ? '#fff' : isBrowsed ? nature.color : '#64748b'}
                    />
                    <Text
                      style={[
                        styles.filterTabPillText,
                        isBrowsed && { color: nature.color, fontFamily: 'texgyB' },
                        isSelected && { color: '#fff' }
                      ]}
                    >
                      {nature.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Lista de crimes específicos da categoria ativa */}
            <Text style={styles.filterSectionTitle}>Selecione um crime específico para analisar:</Text>
            <View style={styles.filterCrimesGrid}>
              {NATURE_LIST.find(n => n.id === activeCategoryTab)?.keys.map(crimeKey => {
                const isSelected = selectedFilter.type === 'specific' && selectedFilter.crimeKey === crimeKey;
                const crimeIcon = getCrimeIcon(crimeKey);
                const count = rawCrimes ? (rawCrimes[crimeKey] ?? 0) : undefined;
                return (
                  <TouchableOpacity
                    key={crimeKey}
                    style={[
                      styles.filterCrimeChip,
                      isSelected && styles.filterCrimeChipActive
                    ]}
                    onPress={() => handleSelectCrime(activeCategoryTab, crimeKey)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.filterCrimeChipIcon, { backgroundColor: isSelected ? '#ffffff24' : `${crimeIcon.color}15` }]}>
                      <FontAwesome6 name={crimeIcon.icon as any} size={11} color={isSelected ? '#fff' : crimeIcon.color} />
                    </View>
                    <Text
                      style={[styles.filterCrimeChipText, isSelected && styles.filterCrimeChipTextActive]}
                      numberOfLines={1}
                    >
                      {formatCrimeName(crimeKey)}
                    </Text>
                    {count !== undefined && (
                      <View style={[styles.filterCrimeChipBadge, isSelected && styles.filterCrimeChipBadgeActive]}>
                        <Text style={[styles.filterCrimeChipBadgeText, isSelected && styles.filterCrimeChipBadgeTextActive]}>
                          {count}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

function SpecificCrimeView({
  analysis,
  crimeKey,
  category,
  onResetToGeneral,
}: {
  analysis: AnalysisResult;
  crimeKey: string;
  category: CrimeCategory;
  onResetToGeneral: () => void;
}) {
  const router = useRouter();
  const crimeName = formatCrimeName(crimeKey);
  const catMeta = CATEGORY_META[category];
  const crimeIcon = getCrimeIcon(crimeKey);
  const count = analysis.rawCrimes?.[crimeKey] ?? 0;
  const totalCity = analysis.totalOccurrences;
  const cityPct = totalCity > 0 ? (count / totalCity) * 100 : 0;

  const categoryMetric = analysis.categories.find(c => c.id === category);
  const catTotal = categoryMetric?.total ?? 0;
  const catPct = catTotal > 0 ? (count / catTotal) * 100 : 0;

  const population = analysis.population;
  const ratePer100k = population && population > 0 ? (count / population) * 100000 : undefined;
  const stateTotal = analysis.stateCrimeTotals?.[crimeKey];

  // Ranking do crime no município
  let rankOnCity: number | null = null;
  if (analysis.rawCrimes) {
    const sorted = Object.entries(analysis.rawCrimes).sort((a, b) => b[1] - a[1]);
    const idx = sorted.findIndex(item => item[0] === crimeKey);
    if (idx >= 0) rankOnCity = idx + 1;
  }

  // Histórico mensal do crime específico
  const trendPoints = (analysis.monthlyCrimes ?? [])
    .map(m => ({
      year: m.year,
      month: m.month,
      total: m.crimes[crimeKey] ?? 0,
    }))
    .filter(p => p.total !== undefined);

  const hasTrend = trendPoints.length >= 2;
  const lastChange = hasTrend
    ? trendPoints[trendPoints.length - 1].total - trendPoints[trendPoints.length - 2].total
    : null;

  return (
    <>
      {/* Hero do Crime Específico */}
      <Animated.View entering={FadeInDown.duration(450)} style={styles.heroShadow}>
        <View style={[styles.crimeHeroCard, { borderColor: `${crimeIcon.color}33` }]}>
          <LinearGradient
            colors={['#0f172a', '#1e293b']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.crimeHeroGradient}
          >
            {/* Header com badge da categoria e botão voltar */}
            <View style={styles.crimeHeroHeaderRow}>
              <View style={[styles.crimeCategoryPill, { backgroundColor: `${catMeta.color}24`, borderColor: `${catMeta.color}40` }]}>
                <FontAwesome6 name={catMeta.icon as any} size={11} color={catMeta.color} />
                <Text style={[styles.crimeCategoryPillText, { color: catMeta.color }]}>{catMeta.label}</Text>
              </View>

              <TouchableOpacity
                style={styles.crimeHeroResetBtn}
                onPress={onResetToGeneral}
                activeOpacity={0.7}
              >
                <FontAwesome6 name="layer-group" size={11} color="#94a3b8" />
                <Text style={styles.crimeHeroResetText}>Visão geral</Text>
              </TouchableOpacity>
            </View>

            {/* Ícone e Nome do Crime */}
            <View style={styles.crimeHeroTitleSection}>
              <View style={[styles.crimeHeroIconBox, { backgroundColor: `${crimeIcon.color}22` }]}>
                <FontAwesome6 name={crimeIcon.icon as any} size={24} color={crimeIcon.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.crimeHeroTitle}>{crimeName}</Text>
                <Text style={styles.crimeHeroSubtitle}>
                  {analysis.displayName || analysis.city} • Dados oficiais SSP-SP
                </Text>
              </View>
            </View>

            {/* Números em Destaque */}
            <View style={styles.crimeHeroStatsRow}>
              <View style={styles.crimeHeroStatBox}>
                <Text style={styles.crimeHeroStatNumber}>{fmtInt(count)}</Text>
                <Text style={styles.crimeHeroStatLabel}>ocorrências registradas</Text>
              </View>

              {ratePer100k !== undefined && (
                <>
                  <View style={styles.crimeHeroStatDivider} />
                  <View style={styles.crimeHeroStatBox}>
                    <Text style={styles.crimeHeroStatNumber}>{fmtRate(ratePer100k)}</Text>
                    <Text style={styles.crimeHeroStatLabel}>a cada 100 mil hab.</Text>
                  </View>
                </>
              )}
            </View>
          </LinearGradient>
        </View>
      </Animated.View>

      {/* Card: Detalhes e Representatividade */}
      <Card
        title="Destaques e Proporção"
        subtitle={`Como ${crimeName} se comporta no município`}
        icon="chart-pie"
        delay={80}
      >
        <View style={{ gap: 14 }}>
          {/* Item 1: Proporção na categoria */}
          <View style={styles.specificMetricRow}>
            <View style={[styles.summaryIcon, { backgroundColor: `${catMeta.color}15` }]}>
              <FontAwesome6 name="chart-pie" size={13} color={catMeta.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryText}>
                Representa <Text style={styles.bold}>{catPct < 1 && catPct > 0 ? '<1' : fmtInt(catPct)}%</Text> de todos os crimes de {catMeta.label} ({fmtInt(catTotal)} casos).
              </Text>
              <View style={{ marginTop: 8 }}>
                <AnimatedBar pct={Math.min(catPct, 100)} color={catMeta.color} height={7} />
              </View>
            </View>
          </View>

          {/* Item 2: Proporção no total do município */}
          <View style={styles.specificMetricRow}>
            <View style={[styles.summaryIcon, { backgroundColor: '#3331ff15' }]}>
              <FontAwesome6 name="city" size={13} color="#3331ff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryText}>
                Corresponde a <Text style={styles.bold}>{cityPct < 1 && cityPct > 0 ? '<1' : fmtInt(cityPct)}%</Text> do total geral de ocorrências da cidade ({fmtInt(totalCity)} registros).
              </Text>
              <View style={{ marginTop: 8 }}>
                <AnimatedBar pct={Math.min(cityPct, 100)} color="#3331ff" height={7} />
              </View>
            </View>
          </View>

          {/* Item 3: Ranking na cidade */}
          {rankOnCity !== null && (
            <View style={styles.specificMetricRow}>
              <View style={[styles.summaryIcon, { backgroundColor: '#f59e0b15' }]}>
                <FontAwesome6 name="ranking-star" size={13} color="#f59e0b" />
              </View>
              <Text style={styles.summaryText}>
                Ocupa a <Text style={styles.bold}>{rankOnCity}ª posição</Text> entre os tipos de crimes registrados no município.
              </Text>
            </View>
          )}

          {/* Item 4: Total no Estado de SP */}
          {stateTotal !== undefined && (
            <View style={styles.specificMetricRow}>
              <View style={[styles.summaryIcon, { backgroundColor: '#64748b15' }]}>
                <FontAwesome6 name="map" size={13} color="#64748b" />
              </View>
              <Text style={styles.summaryText}>
                No estado de São Paulo foram registrados <Text style={styles.bold}>{fmtInt(stateTotal)} casos</Text> desta mesma ocorrência no período.
              </Text>
            </View>
          )}
        </View>
      </Card>

      {/* Card: Evolução Temporal */}
      {hasTrend ? (
        <Card
          title="Evolução mês a mês"
          subtitle={`Histórico de registros de ${crimeName}`}
          icon="chart-line"
          delay={160}
        >
          <LineChart
            data={{
              labels: trendPoints.map(p => fmtPeriodShort(p.month, p.year)),
              datasets: [{
                data: trendPoints.map(p => p.total),
                color: (o = 1) => `${crimeIcon.color}`,
                strokeWidth: 3,
              }],
            }}
            width={SCREEN_WIDTH - 72}
            height={190}
            withInnerLines={false}
            chartConfig={{
              backgroundGradientFrom: '#ffffff',
              backgroundGradientTo: '#ffffff',
              decimalPlaces: 0,
              color: (o = 1) => `${crimeIcon.color}`,
              labelColor: (o = 1) => `rgba(100, 116, 139, ${o})`,
              propsForDots: { r: '4', strokeWidth: '2', stroke: '#fff' },
            }}
            bezier
            style={{ marginLeft: -12 }}
          />
          {lastChange !== null && (
            <View style={styles.trendPill}>
              <FontAwesome6
                name={lastChange > 0 ? 'arrow-trend-up' : lastChange < 0 ? 'arrow-trend-down' : 'minus'}
                size={13}
                color={lastChange > 0 ? '#dc2626' : lastChange < 0 ? '#16a34a' : '#64748b'}
              />
              <Text style={styles.trendText}>
                {lastChange > 0 ? `+${lastChange} casos em relação ao mês anterior` : lastChange < 0 ? `${lastChange} casos em relação ao mês anterior` : 'Estável em relação ao mês anterior'}
              </Text>
            </View>
          )}
        </Card>
      ) : null}

      {/* Card: Orientações de Prevenção */}
      <Card
        title="Orientações e Prevenção"
        subtitle={`Recomendações de segurança para ${catMeta.label}`}
        icon="shield-halved"
        delay={240}
      >
        <View style={{ gap: 12 }}>
          {category === 'patrimony' ? (
            <>
              <View style={styles.tipRow}>
                <FontAwesome6 name="check" size={13} color="#16a34a" style={{ marginTop: 2 }} />
                <Text style={styles.tipText}>
                  Evite deixar bolsas, mochilas ou objetos visíveis dentro de veículos estacionados.
                </Text>
              </View>
              <View style={styles.tipRow}>
                <FontAwesome6 name="check" size={13} color="#16a34a" style={{ marginTop: 2 }} />
                <Text style={styles.tipText}>
                  Prefira estacionar em vias bem iluminadas ou locais com vigilância ativa.
                </Text>
              </View>
              <View style={styles.tipRow}>
                <FontAwesome6 name="check" size={13} color="#16a34a" style={{ marginTop: 2 }} />
                <Text style={styles.tipText}>
                  Ao notar movimentação suspeita, comunique imediatamente a Polícia Militar pelo 190.
                </Text>
              </View>
            </>
          ) : category === 'physical' ? (
            <>
              <View style={styles.tipRow}>
                <FontAwesome6 name="check" size={13} color="#16a34a" style={{ marginTop: 2 }} />
                <Text style={styles.tipText}>
                  Em situações de emergência ou agressão, acione o 190 ou dirija-se a uma delegacia.
                </Text>
              </View>
              <View style={styles.tipRow}>
                <FontAwesome6 name="check" size={13} color="#16a34a" style={{ marginTop: 2 }} />
                <Text style={styles.tipText}>
                  Para casos de violência contra a mulher, utilize a Central de Atendimento Disque 180.
                </Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.tipRow}>
                <FontAwesome6 name="check" size={13} color="#16a34a" style={{ marginTop: 2 }} />
                <Text style={styles.tipText}>
                  Denúncias anônimas sobre crimes contra a vida podem ser feitas via Disque Denúncia 181.
                </Text>
              </View>
              <View style={styles.tipRow}>
                <FontAwesome6 name="check" size={13} color="#16a34a" style={{ marginTop: 2 }} />
                <Text style={styles.tipText}>
                  Em casos imediatos de risco à vida, ligue 190 imediatamente.
                </Text>
              </View>
            </>
          )}
        </View>
      </Card>

      {/* CTA de Vigia focado */}
      <Animated.View entering={FadeInDown.delay(300).duration(450)} style={styles.ctaCard}>
        <View style={[styles.ctaIcon, { backgroundColor: `${crimeIcon.color}15` }]}>
          <FontAwesome6 name="eye" size={18} color={crimeIcon.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.ctaTitle} numberOfLines={2}>Fique em alerta em {analysis.displayName || analysis.city}</Text>
          <Text style={styles.ctaText}>Crie um Vigia e receba alertas da comunidade em tempo real.</Text>
        </View>
        <TouchableOpacity
          style={[styles.ctaButton, { backgroundColor: crimeIcon.color === '#000000' ? '#1c1f75' : crimeIcon.color }]}
          activeOpacity={0.85}
          onPress={() => router.push({ pathname: '/home', params: { switchTab: 'locais' } })}
        >
          <FontAwesome6 name="arrow-right" size={14} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
    </>
  );
}

/* ================================================================== */
/* Tela                                                                */
/* ================================================================== */

export default function Analise() {
  const insets = useSafeAreaInsets();
  const { searchMode, userCity, setUserCity, searchedCity, setLocation } = useSearchLocation();
  const activeCity = searchMode ? searchedCity : userCity;
  const { analysis, loading, error, refresh } = useCrimeAnalysis(activeCity);
  const [refreshing, setRefreshing] = useState(false);
  const [locationLoading, setLocationLoading] = useState(!userCity && !searchMode);
  const [selectedFilter, setSelectedFilter] = useState<FilterSelection>({ type: 'general' });

  // Resetar para visão geral ao trocar de cidade
  useEffect(() => {
    setSelectedFilter({ type: 'general' });
  }, [activeCity]);

  // Garante a busca da localização do usuário caso ainda não esteja disponível
  useEffect(() => {
    if (userCity || searchMode) {
      setLocationLoading(false);
      return;
    }

    let isMounted = true;
    setLocationLoading(true);

    const detectLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (isMounted) setLocationLoading(false);
          return;
        }

        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!isMounted) return;

        setLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });

        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${loc.coords.latitude}&lon=${loc.coords.longitude}&format=json&accept-language=pt-BR`,
          { headers: { 'User-Agent': 'Gardio/1.0' } }
        );
        const geoJson = await geoRes.json();
        const nomeEncontrado =
          geoJson?.address?.city ||
          geoJson?.address?.town ||
          geoJson?.address?.municipality ||
          geoJson?.address?.state;

        if (nomeEncontrado && isMounted) {
          setUserCity(normalizarCidade(nomeEncontrado));
        }
      } catch (err) {
        console.warn('Erro ao obter localização em Análise:', err);
      } finally {
        if (isMounted) {
          setLocationLoading(false);
        }
      }
    };

    detectLocation();

    return () => {
      isMounted = false;
    };
  }, [userCity, searchMode]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const isLoading = (locationLoading || loading) && !refreshing;

  const renderBody = () => {
    if (isLoading) {
      return (
        <Animated.View entering={FadeInDown.duration(350)} style={styles.loadingContainer}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#1c1f75" />
            <Text style={styles.loadingTitle}>
              {locationLoading && !activeCity ? 'Identificando sua localização...' : 'Carregando análise...'}
            </Text>
            <Text style={styles.loadingSubtitle}>
              {locationLoading && !activeCity
                ? 'Obtendo a sua região para exibir os dados'
                : 'Buscando estatísticas e índices de segurança'}
            </Text>
          </View>
        </Animated.View>
      );
    }

    if (!activeCity) {
      return (
        <StateMessage
          icon="map-location-dot"
          title="Escolha uma cidade"
          text={
            searchMode
              ? 'Use a busca acima para ver a análise de qualquer cidade paulista.'
              : 'Não conseguimos identificar sua localização. Pesquise uma cidade na barra acima.'
          }
        />
      );
    }

    if (error === 'error') {
      return (
        <StateMessage
          icon="wifi"
          title="Algo deu errado"
          text="Não foi possível carregar a análise. Verifique sua conexão."
          action={{ label: 'Tentar novamente', onPress: refresh }}
        />
      );
    }

    if (error === 'not_found' || !analysis) {
      return (
        <StateMessage
          icon="magnifying-glass-location"
          title="Sem dados para esta cidade"
          text="Ainda não há registros oficiais suficientes para analisar esta região. Tente outra cidade."
        />
      );
    }

    return (
      <ScrollView
        key={analysis.city}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={Keyboard.dismiss}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1c1f75" />}
      >
        {/* Filtro de Crimes no topo (Card longo horizontal) */}
        <CrimeFilterCard
          selectedFilter={selectedFilter}
          onSelectFilter={setSelectedFilter}
          rawCrimes={analysis.rawCrimes}
        />

        {selectedFilter.type === 'general' ? (
          <>
            <Hero analysis={analysis} />
            <Summary analysis={analysis} />
            <StatePosition analysis={analysis} />
            <Breakdown analysis={analysis} />
            <CategoryComparison analysis={analysis} />
            <TopCrimes analysis={analysis} />
            <Trend analysis={analysis} />
            <VigiaCta analysis={analysis} />
          </>
        ) : (
          <SpecificCrimeView
            analysis={analysis}
            crimeKey={selectedFilter.crimeKey}
            category={selectedFilter.category}
            onResetToGeneral={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setSelectedFilter({ type: 'general' });
            }}
          />
        )}

        <Text style={styles.sources}>
          Fontes: SSP-SP ({fmtPeriodLong(analysis.dataQuality.lastPeriod)})
          {analysis.dataQuality.hasPopulation ? ' e IBGE (Censo 2022)' : ''}. Os números refletem apenas ocorrências
          registradas oficialmente.
        </Text>
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>Análise</Text>
        </View>
        <CitySearchBar />
      </View>
      <View style={{ flex: 1 }}>{renderBody()}</View>
    </View>
  );
}

/* ================================================================== */
/* Estilos                                                             */
/* ================================================================== */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  bold: { fontFamily: 'texgyB', color: '#0f172a' },

  header: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 10,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 },
  headerTitle: { fontFamily: 'texgyB', fontSize: 26, color: '#000' },

  scrollContent: { paddingHorizontal: 16, paddingTop: 20 },

  /* Loading */
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 60 },
  loadingCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1c1f75',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
    width: '100%',
    maxWidth: 320,
  },
  loadingTitle: { fontFamily: 'texgyB', fontSize: 16, color: '#0f172a', marginTop: 18, textAlign: 'center' },
  loadingSubtitle: { fontFamily: 'texgyR', fontSize: 13, color: '#64748b', marginTop: 6, textAlign: 'center', lineHeight: 18 },

  /* Hero */
  heroShadow: { borderRadius: 28, marginBottom: 16, shadowColor: '#1c1f75', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.35, shadowRadius: 18, elevation: 10 },
  hero: { borderRadius: 28, overflow: 'hidden', backgroundColor: '#0a0d2e', position: 'relative' },
  heroContent: { paddingHorizontal: 20, paddingVertical: 22 },
  heroContentSmall: { paddingHorizontal: 16, paddingVertical: 18 },
  heroBgImage: { position: 'absolute', bottom: 0, left: 0 },
  heroChip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  heroChipText: { fontFamily: 'texgyB', fontSize: 11, color: '#e0e7ff', textTransform: 'capitalize' },
  heroCity: { fontFamily: 'texgyB', fontSize: 28, color: '#fff', marginTop: 12, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },
  heroPop: { fontFamily: 'texgyR', fontSize: 13, color: '#c7d2fe', marginTop: 4 },
  heroStats: { flexDirection: 'row', alignItems: 'center', marginTop: 18, width: '100%' },
  heroStat: { flex: 1, minWidth: 0 },
  heroStatValue: { fontFamily: 'texgyB', fontSize: 30, color: '#fff', textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  heroStatLabel: { fontFamily: 'texgyR', fontSize: 12, color: '#c7d2fe', marginTop: 2, lineHeight: 16 },
  heroDivider: { width: 1, height: 42, backgroundColor: 'rgba(255,255,255,0.22)', marginHorizontal: 12 },
  heroDividerSmall: { marginHorizontal: 8 },
  verdictPill: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12 },
  verdictDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  verdictText: { flex: 1, fontFamily: 'texgyB', fontSize: 13.5, color: '#fff' },
  verdictPct: { fontFamily: 'texgyB', fontSize: 14, color: '#c7d2fe' },

  /* Card */
  card: { backgroundColor: '#fff', borderRadius: 24, padding: 20, marginBottom: 16, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 14,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  cardIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#eef2ff', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: 'texgyB', fontSize: 18, color: '#0f172a' },
  cardSubtitle: { fontFamily: 'texgyR', fontSize: 12, color: '#64748b', marginTop: 2 },
  footnote: { fontFamily: 'texgyR', fontSize: 11, color: '#94a3b8', marginTop: 14 },

  /* Summary */
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  summaryIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  summaryText: { flex: 1, fontFamily: 'texgyR', fontSize: 14.5, color: '#334155', lineHeight: 21 },

  /* Gauge */
  gaugeSection: { marginTop: 22, paddingTop: 18, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  gaugeTitle: { fontFamily: 'texgyR', fontSize: 14, color: '#334155', lineHeight: 20, marginBottom: 12 },

  /* Breakdown */
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  legend: { flex: 1, gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontFamily: 'texgyB', fontSize: 13, color: '#1e293b' },
  legendCount: { fontFamily: 'texgyR', fontSize: 11, color: '#94a3b8' },
  legendPct: { fontFamily: 'texgyB', fontSize: 15, color: '#0f172a' },

  /* Top crimes */
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  topRank: { width: 14, fontFamily: 'texgyB', fontSize: 13, color: '#94a3b8', textAlign: 'center' },
  topIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  topName: { flex: 1, fontFamily: 'texgyB', fontSize: 14, color: '#1e293b' },
  topCount: { fontFamily: 'texgyB', fontSize: 14, color: '#0f172a' },

  /* Trend */
  trendPill: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center', backgroundColor: '#f8fafc', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, marginTop: 8 },
  trendText: { fontFamily: 'texgyB', fontSize: 13, color: '#334155' },

  /* CTA */
  ctaCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', borderRadius: 24, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#1c1f75', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 },
  ctaIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#eef2ff', alignItems: 'center', justifyContent: 'center' },
  ctaTitle: { fontFamily: 'texgyB', fontSize: 15, color: '#0f172a' },
  ctaText: { fontFamily: 'texgyR', fontSize: 12, color: '#64748b', marginTop: 2 },
  ctaButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#1c1f75', alignItems: 'center', justifyContent: 'center', shadowColor: '#1c1f75', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3 },

  sources: { fontFamily: 'texgyR', fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 4, paddingHorizontal: 16, lineHeight: 16 },

  /* Estados */
  stateContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, paddingBottom: 80 },
  stateIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#eef2ff', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  stateTitle: { fontFamily: 'texgyB', fontSize: 19, color: '#0f172a', textAlign: 'center' },
  stateText: { fontFamily: 'texgyR', fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 21, marginTop: 8 },
  stateButton: { marginTop: 20, backgroundColor: '#000', paddingHorizontal: 22, paddingVertical: 12, borderRadius: 22 },
  stateButtonText: { fontFamily: 'texgyB', fontSize: 14, color: '#fff' },

  /* Filtro de Crimes */
  filterCardShadow: {
    marginBottom: 16,
    shadowColor: '#1c1f75',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  filterCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  filterCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  filterIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterEyebrow: {
    fontFamily: 'texgyR',
    fontSize: 11,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterCurrentTitle: {
    fontFamily: 'texgyB',
    fontSize: 16,
    color: '#0f172a',
    marginTop: 2,
  },
  filterHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterClearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  filterClearText: {
    fontFamily: 'texgyB',
    fontSize: 11,
    color: '#3331ff',
  },
  filterChevronCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChevronRotated: {
    backgroundColor: '#e2e8f0',
  },
  filterExpandArea: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  filterDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginBottom: 14,
  },
  filterSectionTitle: {
    fontFamily: 'texgyB',
    fontSize: 12,
    color: '#475569',
    marginBottom: 10,
  },
  filterTabsRow: {
    gap: 8,
    paddingBottom: 12,
  },
  filterTabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterTabPillActive: {
    backgroundColor: '#1c1f75',
    borderColor: '#1c1f75',
  },
  filterTabPillText: {
    fontFamily: 'texgyR',
    fontSize: 12,
    color: '#475569',
  },
  filterTabPillTextActive: {
    color: '#fff',
    fontFamily: 'texgyB',
  },
  filterCrimesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterCrimeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    maxWidth: '100%',
  },
  filterCrimeChipActive: {
    backgroundColor: '#1c1f75',
    borderColor: '#1c1f75',
  },
  filterCrimeChipIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  filterCrimeChipText: {
    fontFamily: 'texgyR',
    fontSize: 12,
    color: '#334155',
    flexShrink: 1,
  },
  filterCrimeChipTextActive: {
    color: '#fff',
    fontFamily: 'texgyB',
  },
  filterCrimeChipBadge: {
    marginLeft: 6,
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  filterCrimeChipBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  filterCrimeChipBadgeText: {
    fontFamily: 'texgyB',
    fontSize: 10,
    color: '#475569',
  },
  filterCrimeChipBadgeTextActive: {
    color: '#fff',
  },

  /* Specific Crime View */
  crimeHeroCard: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
  },
  crimeHeroGradient: {
    padding: 20,
  },
  crimeHeroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  crimeCategoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  crimeCategoryPillText: {
    fontFamily: 'texgyB',
    fontSize: 11,
  },
  crimeHeroResetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  crimeHeroResetText: {
    fontFamily: 'texgyR',
    fontSize: 11,
    color: '#cbd5e1',
  },
  crimeHeroTitleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
  },
  crimeHeroIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crimeHeroTitle: {
    fontFamily: 'texgyB',
    fontSize: 22,
    color: '#fff',
  },
  crimeHeroSubtitle: {
    fontFamily: 'texgyR',
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  crimeHeroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  crimeHeroStatBox: {
    flex: 1,
  },
  crimeHeroStatNumber: {
    fontFamily: 'texgyB',
    fontSize: 24,
    color: '#fff',
  },
  crimeHeroStatLabel: {
    fontFamily: 'texgyR',
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  crimeHeroStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginHorizontal: 12,
  },
  specificMetricRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  tipText: {
    flex: 1,
    fontFamily: 'texgyR',
    fontSize: 13.5,
    color: '#334155',
    lineHeight: 19,
  },
});
