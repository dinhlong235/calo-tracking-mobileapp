export interface Profile {
  user_id: string;
  email: string;
  display_name: string | null;
  daily_calorie_goal: number;
  created_at: string;
}

export interface MealLog {
  id: string;
  user_id: string;
  photo_url: string | null;
  food_name: string;
  estimated_calories: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  portion_size: string;
  logged_at: string;
  is_ai_estimated: boolean;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at'> & { created_at?: string };
        Update: Partial<Omit<Profile, 'user_id' | 'created_at'>>;
      };
      meal_logs: {
        Row: MealLog;
        Insert: Omit<MealLog, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<MealLog, 'id' | 'user_id' | 'created_at'>>;
      };
    };
  };
}
