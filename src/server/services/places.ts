const PLACES_TEXT_SEARCH = 'https://places.googleapis.com/v1/places:searchText';

const FIELD_MASK = [
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.rating',
  'places.websiteUri',
  'places.googleMapsUri',
  'places.businessStatus',
].join(',');

export interface PlaceSuggestion {
  name: string;
  phone?: string;
  address?: string;
  rating?: number;
  mapsUrl?: string;
  website?: string;
}

// Maps common vendor category keywords to better Indian-context search terms
const CATEGORY_QUERY_MAP: Array<[RegExp, string]> = [
  [/photog/i, 'wedding photographer'],
  [/videograph/i, 'wedding videographer'],
  [/cater/i, 'wedding catering service'],
  [/decor|flower|floral/i, 'wedding decorator florist'],
  [/mandap/i, 'wedding mandap decorator'],
  [/venue|hall|banquet/i, 'wedding banquet hall venue'],
  [/mehendi|henna/i, 'mehendi artist'],
  [/makeup|beauty|bridal/i, 'bridal makeup artist'],
  [/dj|music|band|entertain/i, 'wedding DJ music band'],
  [/pandit|pujari|priest/i, 'pandit pujari'],
  [/tent|shamiana/i, 'tent house shamiana rental'],
  [/transport|car|horse/i, 'wedding car baraat horse rental'],
  [/invitation|card/i, 'wedding invitation card printing'],
  [/cake|pastry/i, 'wedding cake bakery'],
  [/jewel/i, 'wedding jewellery shop'],
  [/sound|light/i, 'wedding sound light system'],
  [/choreograph/i, 'wedding choreographer dance'],
  [/caricature|artist/i, 'wedding artist caricature'],
];

function buildSearchQuery(category: string, city: string, subEvent?: string): string {
  let term = category;
  for (const [pattern, mapped] of CATEGORY_QUERY_MAP) {
    if (pattern.test(category)) {
      term = mapped;
      break;
    }
  }
  const suffix = subEvent ? ` for ${subEvent}` : '';
  return `${term}${suffix} in ${city}`;
}

interface PlacesApiPlace {
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  rating?: number;
  websiteUri?: string;
  googleMapsUri?: string;
  businessStatus?: string;
}

export async function searchVendorsByCategory(
  category: string,
  city: string,
  apiKey: string,
  subEvent?: string,
  maxResults = 5,
): Promise<PlaceSuggestion[]> {
  const textQuery = buildSearchQuery(category, city, subEvent);

  const res = await fetch(PLACES_TEXT_SEARCH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery,
      maxResultCount: maxResults,
      languageCode: 'en',
      regionCode: 'IN',
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Places API ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as { places?: PlacesApiPlace[] };
  const places = data.places ?? [];

  return places
    .filter((p) => p.businessStatus !== 'CLOSED_PERMANENTLY')
    .map((p) => ({
      name: p.displayName?.text ?? 'Unknown',
      phone: p.nationalPhoneNumber ?? p.internationalPhoneNumber,
      address: p.formattedAddress,
      rating: p.rating,
      mapsUrl: p.googleMapsUri,
      website: p.websiteUri,
    }));
}
