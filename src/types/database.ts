export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "no_show"
  | "cancelled";

export type DepositStatus = "none" | "paid" | "refunded";

// --- Row types (what comes back from the DB) ---

export interface Shop {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  whatsapp: string | null;
  opening_hours: Json;
  deposit_required: boolean;
  deposit_amount: number;
  created_at: string;
}

export interface Barber {
  id: string;
  user_id: string;
  shop_id: string | null;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  portfolio_urls: string[];
  rating: number;
  is_independent: boolean;
  created_at: string;
}

export interface Service {
  id: string;
  shop_id: string;
  name: string;
  duration_min: number;
  price: number;
  currency: string;
  is_active: boolean;
  created_at: string;
}

export interface BarberService {
  barber_id: string;
  service_id: string;
}

export interface Booking {
  id: string;
  client_id: string;
  barber_id: string;
  shop_id: string;
  service_id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: BookingStatus;
  deposit_status: DepositStatus;
  deposit_amount: number;
  whatsapp_reminder_sent: boolean;
  created_at: string;
}

export interface Client {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  created_at: string;
}

export interface Review {
  id: string;
  booking_id: string;
  client_id: string;
  barber_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

// --- Insert types ---

export type ShopInsert = Omit<Shop, "id" | "created_at">;
export type BarberInsert = Omit<Barber, "id" | "created_at">;
export type ServiceInsert = Omit<Service, "id" | "created_at">;
export type BookingInsert = Omit<Booking, "id" | "created_at">;
export type ClientInsert = Omit<Client, "id" | "created_at">;
export type ReviewInsert = Omit<Review, "id" | "created_at">;

// --- Supabase Database type (for typed client) ---

export interface Database {
  public: {
    Tables: {
      shops: {
        Row: Shop;
        Insert: ShopInsert;
        Update: Partial<ShopInsert>;
      };
      barbers: {
        Row: Barber;
        Insert: BarberInsert;
        Update: Partial<BarberInsert>;
      };
      services: {
        Row: Service;
        Insert: ServiceInsert;
        Update: Partial<ServiceInsert>;
      };
      barber_services: {
        Row: BarberService;
        Insert: BarberService;
        Update: Partial<BarberService>;
      };
      bookings: {
        Row: Booking;
        Insert: BookingInsert;
        Update: Partial<BookingInsert>;
      };
      clients: {
        Row: Client;
        Insert: ClientInsert;
        Update: Partial<ClientInsert>;
      };
      reviews: {
        Row: Review;
        Insert: ReviewInsert;
        Update: Partial<ReviewInsert>;
      };
    };
  };
}

export interface OpeningHours {
  [day: string]: {
    open: string;
    close: string;
    closed: boolean;
  };
}
