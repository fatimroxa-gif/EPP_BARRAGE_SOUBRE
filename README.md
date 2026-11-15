# EPP BARRAGE SOUBRE - portail scolaire

Site + serveur sécurisé : les mots de passe et les droits d'accès sont vérifiés sur le serveur (fonction Netlify), les données sont dans une base Supabase. Aucune clé secrète n'est dans le code du site.

## Rôles
- **Directeur** : crée son compte (nom + mot de passe) à sa première connexion. Il gère élèves, matières, photos, actualités, comptes des maîtres, archives, et voit toutes les classes.
- **Maître** : le directeur autorise d'abord la création de son compte (Administration > Comptes des maîtres). Le maître choisit ensuite son nom et son mot de passe. Il ne voit et ne modifie que sa classe (appel, notes, bulletins, résultats). Il ne peut pas modifier les matières.
- **Parent** : matricule + téléphone de l'enfant ; présence et bulletin en lecture seule.

## Matières (programme éducatif du primaire, Côte d'Ivoire)
CP1-CP2 : Français, Mathématiques, EDHC, EPS, Arts (AEC). CE1 à CM2 : les mêmes + Histoire-Géographie + Sciences et Technologie. Le directeur les charge en un clic (Administration > Matières par classe) et peut les adapter (coefficients: 1 par défaut).

## Mise en ligne (environ 15 minutes)
1. **Supabase** (supabase.com, gratuit) : créez un projet, ouvrez *SQL Editor*, collez `supabase-schema.sql`, cliquez *Run*.
2. Dans *Project Settings > API*, relevez le **Project URL** et la clé **service_role** (secrète : ne la partagez jamais, ne la mettez pas dans le code).
3. **Netlify** : déployez ce dossier avec Git (GitHub) ou avec la ligne de commande (`npm i -g netlify-cli`, puis `netlify deploy --prod`). Un simple glisser-déposer ne suffit pas toujours pour les fonctions.
4. Dans *Site settings > Environment variables*, ajoutez :
   - `SUPABASE_URL` = le Project URL
   - `SUPABASE_SERVICE_KEY` = la clé service_role
   - `AUTH_SECRET` = une longue phrase aléatoire (32 caractères minimum)
   - `SETUP_CODE` = un code d'installation de votre choix (empêche un inconnu de créer le compte du directeur avant vous)
5. Redéployez, ouvrez le site > Administration : créez le compte du directeur (il faudra le code d'installation).

## Tester sur votre ordinateur
`npm i -g netlify-cli`, créez un fichier `.env` avec les 4 variables ci-dessus, puis `netlify dev`. (Live Server seul ne fait pas tourner le serveur.)

## Images à ajouter
`pohto5_(1).jpeg` à `pohto5_(16).jpeg` et `musique epp .mp3` (à récupérer sur l'ancien site). `logo.jpg` et `ImageDirecteur.jpg` sont inclus.

## À savoir
- Mot de passe oublié : le directeur réinitialise le compte d'un maître. Pour le directeur, supprimez la ligne `director` de la table `epp_accounts` dans Supabase, puis recréez le compte.
- Copie de sécurité : Administration > Télécharger une copie.
