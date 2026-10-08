export interface RawCrimeData {
  [city: string]: {
    [crimeType: string]: {
      quantidade: number;
      localizacoes: { latitude: number; longitude: number }[];
    }
  }
}

export const fetchCrimeDataForPeriod = async (month: number, year: number): Promise<RawCrimeData | null> => {
  try {
    const res = await fetch(`https://gryfocorp.web.app/ssp-${month}-${year}.json`);
    if (!res.ok) {
      if (res.status === 404) return null; // Period not available yet
      throw new Error(`Failed to fetch data for ${month}/${year}`);
    }
    const json = await res.json();
    return json as RawCrimeData;
  } catch (error) {
    console.error(`Error fetching crime data for ${month}/${year}:`, error);
    throw error;
  }
};

const CACHE: Record<string, RawCrimeData> = {};
const PENDING_REQUESTS: Record<string, Promise<RawCrimeData | null>> = {};

export const getCrimeData = async (month: number, year: number, forceRefresh: boolean = false): Promise<RawCrimeData | null> => {
  const cacheKey = `${month}-${year}`;
  
  if (!forceRefresh) {
    if (CACHE[cacheKey]) {
      return CACHE[cacheKey];
    }

    if (PENDING_REQUESTS[cacheKey]) {
      return PENDING_REQUESTS[cacheKey];
    }
  }

  const request = fetchCrimeDataForPeriod(month, year).then(data => {
    if (data) {
      CACHE[cacheKey] = data;
    }
    delete PENDING_REQUESTS[cacheKey];
    return data;
  });

  PENDING_REQUESTS[cacheKey] = request;
  return request;
};

// V1 implementation: We only know of 2/2026 right now.
export const fetchAvailableHistory = async (forceRefresh: boolean = false): Promise<{ year: number, month: number, data: RawCrimeData }[]> => {
  const history = [];
  
  // Try fetching the known data
  const dataFeb2026 = await getCrimeData(2, 2026, forceRefresh);
  if (dataFeb2026) {
    history.push({ year: 2026, month: 2, data: dataFeb2026 });
  }

  // Future-proofing: We could try to probe other months if they were deployed, 
  // but for V1 we just use the known available period to avoid excessive 404s.
  // If we had an endpoint that lists available periods, we'd call it here.

  return history;
};
