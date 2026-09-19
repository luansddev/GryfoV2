export const TempoOcorrido = (timestamp: Date | number | string): String => {
  const agora = new Date();
  const data = new Date(timestamp);
  const diffSegundos = Math.floor((agora - data) / 1000);
  
  // Cálculos de tempo
  const minutos = Math.floor(diffSegundos / 60);
  const horas = Math.floor(minutos / 60);
  const dias = Math.floor(horas / 24);
  const semanas = Math.floor(dias / 7);
  const meses = Math.floor(dias / 30);
  const anos = Math.floor(dias / 365);

  // Lógica de exibição
  if (diffSegundos < 60) {
    return 'agora mesmo';
  } else if (minutos < 60) {
    return `há ${minutos} minuto${minutos !== 1 ? 's' : ''}`;
  } else if (horas < 24) {
    return `há ${horas} hora${horas !== 1 ? 's' : ''}`;
  } else if (dias < 7) {
    return `há ${dias} dia${dias !== 1 ? 's' : ''}`;
  } else if (semanas < 4) {
    return `há ${semanas} semana${semanas !== 1 ? 's' : ''}`;
  } else if (meses < 12) {
    return `há ${meses} ${meses !== 1 ? 'meses' : 'mês'}`;
  } else {
    return `há ${anos} ano${anos !== 1 ? 's' : ''}`;
  }
};