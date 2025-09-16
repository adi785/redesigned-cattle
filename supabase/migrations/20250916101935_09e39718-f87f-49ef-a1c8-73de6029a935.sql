-- Create enum for animal types
CREATE TYPE public.animal_type AS ENUM ('cattle', 'buffalo');

-- Create enum for common Indian cattle and buffalo breeds
CREATE TYPE public.breed_type AS ENUM (
  -- Cattle breeds
  'gir', 'sahiwal', 'red_sindhi', 'tharparkar', 'rathi', 'hariana', 'ongole', 'krishna_valley', 'deoni', 'khillari',
  'hallikar', 'amritmahal', 'kangayam', 'pulikulam', 'bargur', 'malvi', 'nimari', 'dangi', 'gaolao', 'jersey_cross',
  'holstein_friesian_cross', 'crossbred',
  -- Buffalo breeds  
  'murrah', 'nili_ravi', 'surti', 'jaffarabadi', 'bhadawari', 'nagpuri', 'toda', 'pandharpuri', 'kalahandi', 'mehsana'
);

-- Create breeds reference table
CREATE TABLE public.breeds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  breed_code breed_type NOT NULL UNIQUE,
  animal_type animal_type NOT NULL,
  description TEXT,
  characteristics JSONB,
  native_region TEXT,
  is_indigenous BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create users profile table for FLWs
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  employee_id TEXT UNIQUE,
  designation TEXT,
  district TEXT,
  state TEXT,
  phone TEXT,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create animal records table
CREATE TABLE public.animal_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  animal_id TEXT NOT NULL, -- BPA animal ID
  animal_type animal_type NOT NULL,
  predicted_breed breed_type,
  manual_breed breed_type,
  final_breed breed_type,
  confidence_score DECIMAL(5,4), -- AI confidence score (0-1)
  image_url TEXT,
  location_data JSONB, -- GPS coordinates, village, etc.
  owner_details JSONB, -- farmer information
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  verified_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(animal_id, user_id)
);

-- Create breed predictions log table
CREATE TABLE public.breed_predictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  animal_record_id UUID NOT NULL REFERENCES public.animal_records(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  predicted_breeds JSONB NOT NULL, -- Array of predictions with confidence scores
  model_version TEXT,
  processing_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert common Indian breeds data
INSERT INTO public.breeds (name, breed_code, animal_type, description, native_region, is_indigenous) VALUES
-- Cattle breeds
('Gir', 'gir', 'cattle', 'Indigenous dairy breed known for high milk yield and heat tolerance', 'Gujarat', true),
('Sahiwal', 'sahiwal', 'cattle', 'High milk yielding breed with excellent heat tolerance', 'Punjab, Pakistan', true),
('Red Sindhi', 'red_sindhi', 'cattle', 'Hardy breed with good milk production and heat resistance', 'Sindh, Pakistan', true),
('Tharparkar', 'tharparkar', 'cattle', 'Dual purpose breed from Thar desert region', 'Rajasthan', true),
('Rathi', 'rathi', 'cattle', 'Medium-sized dual purpose breed', 'Rajasthan', true),
('Hariana', 'hariana', 'cattle', 'Draft breed with good milk production', 'Haryana', true),
('Ongole', 'ongole', 'cattle', 'Large-sized draught breed', 'Andhra Pradesh', true),
('Deoni', 'deoni', 'cattle', 'Dual purpose breed from Deccan plateau', 'Maharashtra, Karnataka', true),
('Jersey Cross', 'jersey_cross', 'cattle', 'Crossbred with Jersey genetics', 'Pan-India', false),
('Holstein Friesian Cross', 'holstein_friesian_cross', 'cattle', 'High milk yielding crossbred', 'Pan-India', false),
-- Buffalo breeds
('Murrah', 'murrah', 'buffalo', 'Premier dairy buffalo breed of India', 'Haryana, Punjab', true),
('Nili Ravi', 'nili_ravi', 'buffalo', 'High milk yielding buffalo breed', 'Punjab, Pakistan', true),
('Surti', 'surti', 'buffalo', 'Medium-sized dairy buffalo', 'Gujarat', true),
('Jaffarabadi', 'jaffarabadi', 'buffalo', 'Large-sized milk buffalo', 'Gujarat', true),
('Bhadawari', 'bhadawari', 'buffalo', 'Small-sized hardy buffalo', 'Uttar Pradesh, Madhya Pradesh', true),
('Mehsana', 'mehsana', 'buffalo', 'Good milk yielding buffalo', 'Gujarat', true);

-- Enable Row Level Security
ALTER TABLE public.breeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.animal_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.breed_predictions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for breeds (public read)
CREATE POLICY "Breeds are publicly readable" 
ON public.breeds FOR SELECT 
USING (true);

CREATE POLICY "Only authenticated users can manage breeds" 
ON public.breeds FOR ALL 
USING (auth.uid() IS NOT NULL);

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- RLS Policies for animal records
CREATE POLICY "Users can view their own animal records" 
ON public.animal_records FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own animal records" 
ON public.animal_records FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own animal records" 
ON public.animal_records FOR UPDATE 
USING (auth.uid() = user_id);

-- RLS Policies for breed predictions
CREATE POLICY "Users can view predictions for their animals" 
ON public.breed_predictions FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.animal_records 
    WHERE animal_records.id = breed_predictions.animal_record_id 
    AND animal_records.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert predictions for their animals" 
ON public.breed_predictions FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.animal_records 
    WHERE animal_records.id = breed_predictions.animal_record_id 
    AND animal_records.user_id = auth.uid()
  )
);

-- Create storage buckets for images
INSERT INTO storage.buckets (id, name, public) VALUES 
('animal-images', 'animal-images', false),
('breed-references', 'breed-references', true);

-- Storage policies for animal images
CREATE POLICY "Users can upload their animal images" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'animal-images' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their animal images" 
ON storage.objects FOR SELECT 
USING (
  bucket_id = 'animal-images' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Anyone can view breed reference images" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'breed-references');

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_breeds_updated_at
  BEFORE UPDATE ON public.breeds
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_animal_records_updated_at
  BEFORE UPDATE ON public.animal_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
  RETURN NEW;
END;
$$;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();