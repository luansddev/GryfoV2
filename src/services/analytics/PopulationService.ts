/**
 * PopulationService
 * Responsible for providing population data for rate calculations.
 */

export const getPopulationForCity = async (city: string): Promise<number | undefined> => {
  // Em uma implementação futura (V2), pode-se consultar a API do IBGE 
  // ou um JSON local contendo a população das cidades.
  // Como não há fonte oficial disponível no momento no projeto, 
  // retornamos undefined para que a interface trate a ausência graciosamente.
  return undefined;
};
