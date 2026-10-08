import { AnalysisResult, AnalysisInsight } from './types';

export const generateRecommendations = (metrics: Partial<AnalysisResult>): AnalysisInsight[] => {
  const recommendations: AnalysisInsight[] = [];

  if (metrics.dominantCategory) {
    const categoryName = {
      'life': 'vida',
      'physical': 'integridade física',
      'patrimony': 'patrimônio',
    }[metrics.dominantCategory];

    recommendations.push({
      id: 'rec_vigia_category',
      type: 'information',
      title: 'Monitore ocorrências da sua região',
      description: `Crimes contra o ${categoryName} representam a maior parcela dos registros. Considere criar um Vigia para acompanhar novas ocorrências dessa categoria e receber notificações.`,
      priority: 10,
    });
  }

  if (metrics.trend?.periodChange) {
    if ((metrics.trend.periodChange.percentageChange ?? 0) > 0) {
      recommendations.push({
        id: 'rec_trend_up',
        type: 'warning',
        title: 'Acompanhe as atualizações',
        description: 'Os registros apresentaram aumento no período analisado. Acompanhe as próximas atualizações de dados oficiais para verificar se essa variação permanece ao longo do tempo.',
        priority: 8,
      });
    }
  }

  if (metrics.dataQuality && !metrics.dataQuality.hasEnoughHistoryForTrend) {
    recommendations.push({
      id: 'rec_low_history',
      type: 'information',
      title: 'Interpretação cuidadosa',
      description: 'Há pouco histórico disponível para sua região. Evite interpretar números isoladamente até que uma série temporal mais longa seja construída.',
      priority: 9,
    });
  }

  return recommendations.sort((a, b) => b.priority - a.priority).slice(0, 3);
};
