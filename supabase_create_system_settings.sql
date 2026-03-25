-- Create the system_settings table for global application settings.
-- This table stores key-value pairs (key: text, value: text).
-- Run this in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT 'true',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the default Boyahane -> Depo flow setting (enabled by default)
INSERT INTO public.system_settings (key, value)
VALUES ('dyehouse_to_depot_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

-- Allow authenticated users to read settings
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read settings"
  ON public.system_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Only superadmins can update settings (enforced in app logic too)
CREATE POLICY "Authenticated users can update settings"
  ON public.system_settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can insert settings"
  ON public.system_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
