# Déploiement du backend sur Render

## 1) Pré-requis
- Repo poussé sur GitHub/GitLab
- Base PostgreSQL disponible (Render PostgreSQL ou externe)

## 2) Méthode recommandée (Blueprint)
1. Sur Render, clique **New +** → **Blueprint**.
2. Sélectionne ton repo.
3. Render détecte `backend/render.yaml`.
4. Vérifie le service `koogwe-backend` puis crée le service.

## 3) Variables d’environnement à renseigner
Obligatoires:
- `DATABASE_URL`
- `JWT_SECRET`

Souvent nécessaires selon tes features:
- `FRONTEND_URL`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `STRIPE_SECRET_KEY`
- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REKOGNITION_COLLECTION_ID`
- `AWS_S3_BUCKET`

## 4) Commandes utilisées en production
- Build: `npm install && npm run build`
- Start: `npm run start:render`

Le script `start:render` exécute automatiquement:
1. `prisma migrate deploy`
2. `node dist/main`

## 5) Notes importantes
- Le dossier local `uploads/` n’est pas persistant sur Render (ephemeral filesystem). Pour la prod, privilégie le stockage S3.
- Le service écoute automatiquement `PORT` fourni par Render via `src/main.ts`.
