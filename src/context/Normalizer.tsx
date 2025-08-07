// src/context/Normalizer.tsx
//Normaliza o padrão do nome das cidades (ex: São Paulo => S.PAULO)

export function normalizarCidade(nome: string): string {
  const comAcento = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const emCaps = comAcento.toUpperCase();

  const abreviado = emCaps.replace(/\bSAO\b/, "S.");

  return abreviado;
}
