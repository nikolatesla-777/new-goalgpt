/**
 * Venue Types
 * 
 * Type definitions for venue/stadium data
 * Critical for "Home Advantage" analysis and future Weather integration
 */

export interface Venue {
  id: string; // UUID
  external_id: string; // TheSports venue ID
  name: string | null;
  city: string | null;
  capacity: number | null;
  country_id: string | null;
  updated_at: Date;
  created_at: Date;
}

export interface VenueData {
  id: string; // TheSports venue ID
  name: string | null;
  city: string | null;
  capacity: number | null;
  country_id: string | null;
}







