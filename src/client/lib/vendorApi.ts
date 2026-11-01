import { z } from 'zod';
import { apiRequest, postJson } from './apiTransport';

const webUrl = z.url().refine((value) => /^https?:\/\//i.test(value), 'Expected an HTTP(S) URL');
const vendorSuggestionSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  address: z.string().optional(),
  rating: z.number().min(0).max(5).optional(),
  mapsUrl: webUrl.optional(),
  website: webUrl.optional(),
});
export type VendorSuggestion = z.infer<typeof vendorSuggestionSchema>;

export async function apiSearchVendors(
  category: string,
  city: string,
  subEvent?: string,
): Promise<VendorSuggestion[]> {
  const data = await apiRequest(
    '/api/vendors/search',
    z.object({ suggestions: z.array(vendorSuggestionSchema) }),
    postJson({ category, city, subEvent }),
  );
  return data.suggestions;
}
