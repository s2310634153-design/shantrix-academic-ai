-- Create submissions table
CREATE TABLE public.submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  file_url TEXT,
  file_name TEXT,
  status TEXT NOT NULL DEFAULT 'processing',
  originality_score INTEGER,
  ai_score INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create reports table
CREATE TABLE public.reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  originality_score INTEGER NOT NULL,
  ai_score INTEGER NOT NULL,
  total_matches INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create matches table for storing plagiarism/AI detection matches
CREATE TABLE public.matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT,
  similarity_percentage NUMERIC(5,2) NOT NULL,
  matched_text TEXT NOT NULL,
  start_position INTEGER NOT NULL,
  end_position INTEGER NOT NULL,
  match_type TEXT NOT NULL DEFAULT 'plagiarism',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- Policies for submissions
CREATE POLICY "Users can view their own submissions"
ON public.submissions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own submissions"
ON public.submissions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own submissions"
ON public.submissions
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own submissions"
ON public.submissions
FOR DELETE
USING (auth.uid() = user_id);

-- Policies for reports
CREATE POLICY "Users can view reports for their submissions"
ON public.reports
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.submissions
    WHERE submissions.id = reports.submission_id
    AND submissions.user_id = auth.uid()
  )
);

-- Policies for matches
CREATE POLICY "Users can view matches for their reports"
ON public.matches
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.reports
    JOIN public.submissions ON submissions.id = reports.submission_id
    WHERE reports.id = matches.report_id
    AND submissions.user_id = auth.uid()
  )
);

-- Create storage bucket for document uploads
INSERT INTO storage.buckets (id, name, public) 
VALUES ('submissions', 'submissions', false);

-- Storage policies for submissions bucket
CREATE POLICY "Users can upload their own files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'submissions' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'submissions' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own files"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'submissions' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'submissions' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_submissions_updated_at
BEFORE UPDATE ON public.submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();