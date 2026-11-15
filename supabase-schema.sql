-- À exécuter une fois dans Supabase : SQL Editor > New query > Run
create table if not exists epp_store (key text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists epp_accounts (key text primary key, data jsonb not null);
-- Sécurité : RLS activée SANS aucune règle = personne ne peut lire/écrire avec la clé publique.
-- Seul le serveur du site (clé "service_role", stockée dans Netlify) accède aux données.
alter table epp_store enable row level security;
alter table epp_accounts enable row level security;
