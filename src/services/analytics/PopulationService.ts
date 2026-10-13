/**
 * PopulationService
 * Responsible for providing population data for rate calculations.
 * Fonte: IBGE – Censo Demográfico 2022 (via CityDirectory).
 */
import { loadIbgeCities, getIbgeCityForSspKey } from './CityDirectory';

export const getPopulationForCity = async (city: string): Promise<number | undefined> => {
  const ibge = await loadIbgeCities();
  return getIbgeCityForSspKey(city, ibge)?.population;
};
