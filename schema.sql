-- Create profiles table
CREATE TABLE public.profiles (
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT,
  daily_calorie_goal INTEGER DEFAULT 2000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create meal_logs table
CREATE TABLE public.meal_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  photo_url TEXT,
  food_name TEXT NOT NULL,
  estimated_calories INTEGER NOT NULL,
  protein_g REAL DEFAULT 0,
  carb_g REAL DEFAULT 0,
  fat_g REAL DEFAULT 0,
  portion_size TEXT DEFAULT '1 portion',
  logged_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  is_ai_estimated BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_logs ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Allow users to read their own profile" 
  ON public.profiles FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

CREATE POLICY "Allow users to update their own profile" 
  ON public.profiles FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = user_id);

CREATE POLICY "Allow users to insert their own profile" 
  ON public.profiles FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

-- Meal Logs Policies
CREATE POLICY "Allow users to read their own meal logs" 
  ON public.meal_logs FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

CREATE POLICY "Allow users to insert their own meal logs" 
  ON public.meal_logs FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to update their own meal logs" 
  ON public.meal_logs FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = user_id);

CREATE POLICY "Allow users to delete their own meal logs" 
  ON public.meal_logs FOR DELETE 
  TO authenticated 
  USING (auth.uid() = user_id);

-- Profile trigger on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name, daily_calorie_goal)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    2000
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
