// src/context/Normalizer.tsx
//Normaliza o padrão do nome das cidades (ex: São Paulo => S.PAULO)

export function normalizarCidade(nome: string): string {
  if (!nome) return '';
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s*-\s*SP$/, "")
    .replace(/['`´]/g, " ")
    .replace(/-/g, " ")
    .replace(/\bSTO\.\s*/g, "S.")
    .replace(/\b(SAO|SANTA|SANTO)\s+/g, "S.")
    .replace(/\bS\.\s+/g, "S.")
    .replace(/\s+/g, " ")
    .trim();
}
