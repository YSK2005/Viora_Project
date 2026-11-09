// Comprehensive list of Indian States & Union Territories (GST Compliant)
export const DEFAULT_INDIAN_STATES: string[] = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
];

const CUSTOM_STATES_KEY = 'viora_custom_states';

export function getStoredCustomStates(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOM_STATES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getAllStates(): string[] {
  const custom = getStoredCustomStates();
  const merged = Array.from(new Set([...DEFAULT_INDIAN_STATES, ...custom]));
  return merged.sort((a, b) => a.localeCompare(b));
}

export function addCustomState(name: string): { states: string[]; added: string | null } {
  const clean = name.trim();
  if (!clean) return { states: getAllStates(), added: null };

  const existing = getAllStates();
  const match = existing.find((s) => s.toLowerCase() === clean.toLowerCase());
  if (match) {
    return { states: existing, added: match };
  }

  // Capitalize words nicely
  const formatted = clean
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  const currentCustom = getStoredCustomStates();
  const nextCustom = [...currentCustom, formatted];
  try {
    localStorage.setItem(CUSTOM_STATES_KEY, JSON.stringify(nextCustom));
  } catch {
    // Ignore storage errors
  }

  return { states: getAllStates(), added: formatted };
}
