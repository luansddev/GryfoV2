import { AnalysisResult, AnalysisInsight } from './types';

export const generateInsights = (metrics: Partial<AnalysisResult>): AnalysisInsight[] => {
  const insights: AnalysisInsight[] = [];

  // 1. Data Quality / Limitations (High Priority)
  if (metrics.dataQuality) {
    if (!metrics.dataQuality.hasEnoughHistoryForTrend) {
      insights.push({
        id: 'insuf_history',
        type: 'information',
        title: 'Histórico Insuficiente',
        description: 'Os dados disponíveis ainda não permitem avaliar uma tendência temporal consistente. São necessários mais meses de coleta.',
        priority: 10,
      });
    }
  }

  // 2. Dominant Category
  if (metrics.dominantCategory && metrics.categories) {
    const dominant = metrics.categories.find(c => c.id === metrics.dominantCategory);
    if (dominant && dominant.percentage > 0) {
      const categoryName = {
        'life': 'Crimes contra a vida',
        'physical': 'Crimes contra a integridade física',
        'patrimony': 'Crimes contra o patrimônio',
      }[metrics.dominantCategory];

      insights.push({
        id: 'dominant_category',
        type: 'information',
        title: `${categoryName} predominam`,
        description: `Essa categoria representa ${dominant.percentage.toFixed(1).replace('.', ',')}% dos registros analisados na região.`,
        priority: 8,
      });
    }
  }

  // 3. Dominant Crime
  if (metrics.dominantCrime && metrics.dominantCrime.total > 0) {
    insights.push({
      id: 'dominant_crime',
      type: 'information',
      title: 'Ocorrência mais frequente',
      description: `A natureza criminal "${metrics.dominantCrime.name}" é a mais registrada, correspondendo a ${metrics.dominantCrime.percentage.toFixed(1).replace('.', ',')}% do total analisado.`,
      priority: 7,
    });
  }

  // 4. Trend / Temporal Changes
  if (metrics.trend?.periodChange) {
    const { absoluteChange, percentageChange, current, previous } = metrics.trend.periodChange;
    
    if (percentageChange !== null) {
      const type = absoluteChange > 0 ? 'increase' : (absoluteChange < 0 ? 'decrease' : 'neutral');
      const action = absoluteChange > 0 ? 'aumento' : (absoluteChange < 0 ? 'redução' : 'estabilidade');
      const pctFormatted = Math.abs(percentageChange).toFixed(1).replace('.', ',');

      let description = `Os registros apresentaram ${action} de ${pctFormatted}% em relação ao período anterior.`;
      
      // Small numbers caveat
      if (previous > 0 && previous <= 5 && absoluteChange !== 0) {
        description = `Foram registrados ${current} casos no período atual contra ${previous} no período anterior. Apesar da variação percentual de ${pctFormatted}%, o número absoluto de registros é muito baixo e não permite caracterizar sozinho uma tendência estatística consistente.`;
      }

      insights.push({
        id: 'period_trend',
        type: type as any,
        title: `Variação de ${pctFormatted}% no período`,
        description,
        priority: 9,
      });
    } else if (previous === 0 && current > 0) {
      insights.push({
        id: 'period_trend_new',
        type: 'increase',
        title: 'Novos registros identificados',
        description: `Não havia registros no período anterior, portanto não é possível calcular uma variação percentual, mas houve ${current} ocorrências no período atual.`,
        priority: 9,
      });
    }
  }

  // Sort by priority (higher priority first)
  return insights.sort((a, b) => b.priority - a.priority).slice(0, 5);
};
