import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSearchLocation } from '../context/SearchLocationContext';
import { useCrimeAnalysis } from '../hooks/useCrimeAnalysis';
import { FontAwesome6 } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { formatCrimeName } from '../constants/CrimeData';

const SCREEN_WIDTH = Dimensions.get('window').width;

const getCategoryColor = (categoryId: string) => {
  switch (categoryId) {
    case 'life': return '#000000';
    case 'physical': return '#dc2626';
    case 'patrimony': return '#64748b';
    default: return '#666';
  }
};

const getCategoryName = (categoryId: string) => {
  switch (categoryId) {
    case 'life': return 'Crimes contra a Vida';
    case 'physical': return 'Integridade Física';
    case 'patrimony': return 'Crimes contra o Patrimônio';
    default: return categoryId;
  }
};

export default function Analise() {
  const insets = useSafeAreaInsets();
  const { searchMode, userCity, searchedCity } = useSearchLocation();
  const activeCity = searchMode ? searchedCity : userCity;
  
  const { analysis, loading, error, refresh } = useCrimeAnalysis(activeCity);

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#000" />
          <Text style={styles.loadingText}>Analisando dados da região...</Text>
        </View>
      );
    }

    if (error === 'error') {
      return (
        <View style={styles.centerContainer}>
          <FontAwesome6 name="triangle-exclamation" size={48} color="#dc2626" style={{ marginBottom: 16 }} />
          <Text style={styles.errorText}>Não foi possível carregar a análise.</Text>
          <Text style={[styles.errorText, { fontSize: 14, marginTop: 8 }]} onPress={refresh}>Tentar novamente</Text>
        </View>
      );
    }

    if (error === 'not_found' || !analysis) {
      return (
        <View style={styles.centerContainer}>
          <FontAwesome6 name="chart-pie" size={48} color="#ccc" style={{ marginBottom: 16 }} />
          <Text style={styles.errorText}>Não encontramos registros suficientes para gerar uma análise desta região.</Text>
        </View>
      );
    }

    const {
      totalOccurrences,
      ratePer100k,
      categories,
      dominantCategory,
      dominantCrime,
      trend,
      insights,
      recommendations,
      dataQuality,
    } = analysis;

    return (
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Análise da sua região</Text>
          <Text style={styles.headerCity}>
            {activeCity ? activeCity.replace(/\bS\./, 'SÃO ').toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Região desconhecida'}
          </Text>
          <Text style={styles.headerSubtitle}>Panorama baseado nos registros oficiais disponíveis</Text>
        </View>

        {/* PANORAMA */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>PANORAMA</Text>
          <View style={styles.panoramaRow}>
            <View style={styles.panoramaItem}>
              <Text style={styles.panoramaValue}>{totalOccurrences.toLocaleString('pt-BR')}</Text>
              <Text style={styles.panoramaLabel}>registros analisados</Text>
            </View>
            <View style={styles.panoramaItem}>
              {ratePer100k !== undefined ? (
                <>
                  <Text style={styles.panoramaValue}>{ratePer100k.toFixed(1).replace('.', ',')}</Text>
                  <Text style={styles.panoramaLabel}>por 100 mil habitantes</Text>
                </>
              ) : (
                <>
                  <Text style={styles.panoramaValue}>-</Text>
                  <Text style={styles.panoramaLabel}>Taxa populacional indisponível</Text>
                </>
              )}
            </View>
          </View>
        </View>

        {/* PRINCIPAL DESTAQUE */}
        {dominantCategory && (
          <View style={[styles.card, { backgroundColor: '#f8fafc' }]}>
            <Text style={styles.cardTitle}>PRINCIPAL DESTAQUE</Text>
            <Text style={styles.highlightText}>
              <Text style={{ fontFamily: 'texgyB', color: getCategoryColor(dominantCategory) }}>
                {getCategoryName(dominantCategory)}
              </Text>{' '}
              representam {categories.find(c => c.id === dominantCategory)?.percentage.toFixed(1).replace('.', ',')}% dos registros analisados.
            </Text>
          </View>
        )}

        {/* EVOLUÇÃO DOS REGISTROS */}
        {trend && dataQuality.hasEnoughHistoryForTrend ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>EVOLUÇÃO DOS REGISTROS</Text>
            
            <LineChart
              data={{
                labels: trend.points.map(p => `${p.month}/${p.year.toString().slice(-2)}`),
                datasets: [
                  {
                    data: trend.points.map(p => p.total),
                    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                    strokeWidth: 2
                  }
                ]
              }}
              width={SCREEN_WIDTH - 64} // padding card (20*2) + margin (12*2) = 64
              height={220}
              chartConfig={{
                backgroundColor: '#ffffff',
                backgroundGradientFrom: '#ffffff',
                backgroundGradientTo: '#ffffff',
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(100, 100, 100, ${opacity})`,
                style: { borderRadius: 16 },
                propsForDots: { r: '4', strokeWidth: '2', stroke: '#fff' }
              }}
              bezier
              style={{ marginVertical: 8, borderRadius: 16 }}
            />
            
            {trend.periodChange && trend.periodChange.percentageChange !== null && (
              <View style={styles.trendChangeContainer}>
                <Text style={styles.trendChangeLabel}>Variação recente:</Text>
                <Text style={[styles.trendChangeValue, { color: trend.periodChange.absoluteChange > 0 ? '#dc2626' : (trend.periodChange.absoluteChange < 0 ? '#16a34a' : '#64748b') }]}>
                  {trend.periodChange.absoluteChange > 0 ? '+' : ''}{trend.periodChange.percentageChange.toFixed(1).replace('.', ',')}%
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>EVOLUÇÃO DOS REGISTROS</Text>
            <Text style={styles.infoText}>São necessários mais períodos para analisar tendências e gerar gráficos temporais.</Text>
          </View>
        )}

        {/* DISTRIBUIÇÃO POR CATEGORIA */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>DISTRIBUIÇÃO POR CATEGORIA</Text>
          <View style={styles.distributionContainer}>
            {categories.map(cat => (
              <View key={cat.id} style={styles.distributionRow}>
                <View style={styles.distributionLabels}>
                  <Text style={styles.distributionName}>{getCategoryName(cat.id)}</Text>
                  <Text style={styles.distributionPct}>{cat.percentage.toFixed(1).replace('.', ',')}%</Text>
                </View>
                <View style={styles.distributionBarBg}>
                  <View style={[styles.distributionBarFill, { width: `${cat.percentage}%`, backgroundColor: getCategoryColor(cat.id) }]} />
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* OCORRÊNCIA MAIS FREQUENTE */}
        {dominantCrime && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>OCORRÊNCIA MAIS FREQUENTE</Text>
            <View style={styles.dominantCrimeContainer}>
              <Text style={styles.dominantCrimeName}>{dominantCrime.name}</Text>
              <Text style={styles.dominantCrimeInfo}>{dominantCrime.total} registros</Text>
              <Text style={styles.dominantCrimeInfoPct}>{dominantCrime.percentage.toFixed(1).replace('.', ',')}% do total analisado</Text>
            </View>
          </View>
        )}

        {/* DESTAQUES DA ANÁLISE */}
        {insights.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>DESTAQUES DA ANÁLISE</Text>
            {insights.map(insight => (
              <View key={insight.id} style={styles.insightCard}>
                <FontAwesome6 
                  name={insight.type === 'increase' ? 'arrow-trend-up' : (insight.type === 'decrease' ? 'arrow-trend-down' : 'circle-info')} 
                  size={16} 
                  color={insight.type === 'increase' ? '#dc2626' : (insight.type === 'decrease' ? '#16a34a' : '#2563eb')} 
                  style={{ marginRight: 12, marginTop: 2 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.insightTitle}>{insight.title}</Text>
                  <Text style={styles.insightDesc}>{insight.description}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* RECOMENDAÇÕES */}
        {recommendations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>RECOMENDAÇÕES</Text>
            {recommendations.map(rec => (
              <View key={rec.id} style={styles.insightCard}>
                <FontAwesome6 
                  name={rec.type === 'warning' ? 'triangle-exclamation' : 'lightbulb'} 
                  size={16} 
                  color={rec.type === 'warning' ? '#d97706' : '#64748b'} 
                  style={{ marginRight: 12, marginTop: 2 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.insightTitle}>{rec.title}</Text>
                  <Text style={styles.insightDesc}>{rec.description}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* SOBRE ESTA ANÁLISE */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>SOBRE ESTA ANÁLISE</Text>
          <View style={styles.qualityContainer}>
            <View style={styles.qualityRow}><Text style={styles.qualityLabel}>Fonte:</Text><Text style={styles.qualityValue}>SSP-SP</Text></View>
            <View style={styles.qualityRow}><Text style={styles.qualityLabel}>Meses disponíveis:</Text><Text style={styles.qualityValue}>{dataQuality.availableMonths}</Text></View>
            {dataQuality.availableMonths > 0 && (
               <View style={styles.qualityRow}><Text style={styles.qualityLabel}>Período analisado:</Text><Text style={styles.qualityValue}>{dataQuality.firstPeriod} a {dataQuality.lastPeriod}</Text></View>
            )}
            <View style={styles.qualityRow}><Text style={styles.qualityLabel}>População:</Text><Text style={styles.qualityValue}>{dataQuality.hasPopulation ? 'IBGE' : 'Indisponível nesta análise'}</Text></View>
          </View>
        </View>
        
        <Text style={styles.disclaimer}>
          Esta análise utiliza registros oficiais disponíveis e não representa a totalidade dos crimes ocorridos. 
          Variações podem refletir diferenças de registro, notificação e disponibilidade dos dados.
        </Text>

      </ScrollView>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {renderContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20 },
  loadingText: { marginTop: 16, fontFamily: 'texgyR', fontSize: 16, color: '#475569' },
  errorText: { fontFamily: 'texgyR', fontSize: 16, color: '#475569', textAlign: 'center', lineHeight: 24 },
  
  header: { marginBottom: 24 },
  headerTitle: { fontFamily: 'texgyR', fontSize: 14, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 },
  headerCity: { fontFamily: 'texgyB', fontSize: 28, color: '#0f172a', marginVertical: 4 },
  headerSubtitle: { fontFamily: 'texgyR', fontSize: 14, color: '#475569' },
  
  card: { backgroundColor: '#ffffff', borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardTitle: { fontFamily: 'texgyB', fontSize: 13, color: '#94a3b8', marginBottom: 16, letterSpacing: 1 },
  
  panoramaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  panoramaItem: { flex: 1 },
  panoramaValue: { fontFamily: 'texgyB', fontSize: 24, color: '#0f172a' },
  panoramaLabel: { fontFamily: 'texgyR', fontSize: 13, color: '#64748b', marginTop: 4 },
  
  highlightText: { fontFamily: 'texgyR', fontSize: 17, color: '#334155', lineHeight: 26 },
  
  trendChangeContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  trendChangeLabel: { fontFamily: 'texgyR', fontSize: 14, color: '#64748b', marginRight: 8 },
  trendChangeValue: { fontFamily: 'texgyB', fontSize: 16 },
  infoText: { fontFamily: 'texgyR', fontSize: 14, color: '#64748b', fontStyle: 'italic', lineHeight: 22 },
  
  distributionContainer: { gap: 16 },
  distributionRow: { gap: 8 },
  distributionLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  distributionName: { fontFamily: 'texgyR', fontSize: 14, color: '#334155' },
  distributionPct: { fontFamily: 'texgyB', fontSize: 14, color: '#0f172a' },
  distributionBarBg: { height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, overflow: 'hidden' },
  distributionBarFill: { height: '100%', borderRadius: 4 },
  
  dominantCrimeContainer: { alignItems: 'center', paddingVertical: 12 },
  dominantCrimeName: { fontFamily: 'texgyB', fontSize: 20, color: '#0f172a', textAlign: 'center', marginBottom: 8 },
  dominantCrimeInfo: { fontFamily: 'texgyB', fontSize: 15, color: '#334155' },
  dominantCrimeInfoPct: { fontFamily: 'texgyR', fontSize: 14, color: '#64748b', marginTop: 4 },
  
  section: { marginBottom: 24 },
  sectionTitle: { fontFamily: 'texgyB', fontSize: 13, color: '#94a3b8', marginBottom: 12, letterSpacing: 1, paddingHorizontal: 4 },
  insightCard: { flexDirection: 'row', backgroundColor: '#ffffff', borderRadius: 12, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  insightTitle: { fontFamily: 'texgyB', fontSize: 15, color: '#1e293b', marginBottom: 4 },
  insightDesc: { fontFamily: 'texgyR', fontSize: 14, color: '#475569', lineHeight: 20 },
  
  qualityContainer: { gap: 8 },
  qualityRow: { flexDirection: 'row', justifyContent: 'space-between' },
  qualityLabel: { fontFamily: 'texgyR', fontSize: 14, color: '#64748b' },
  qualityValue: { fontFamily: 'texgyB', fontSize: 14, color: '#334155' },
  
  disclaimer: { fontFamily: 'texgyR', fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 16, paddingHorizontal: 16, lineHeight: 18 }
});
