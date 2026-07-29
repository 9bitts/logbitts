# Logbitts — Fase 1 (DMS + Roteirização)

Gestão de entregas, montagem de rotas, torre de controle e app motorista (PWA) com POD.

## Stack

- Next.js (App Router) + TypeScript
- PostgreSQL via **PGlite embutido** (zero config) ou Neon/Docker
- Drizzle ORM + Better Auth (multi-tenant por organização)
- MapLibre + deep link Waze/Google Maps
- Upload local de fotos/assinaturas (`uploads/`)

## Setup rápido

```bash
npm install
cp .env.example .env   # já pode usar o .env com USE_PGLITE=1
npm run icons
npm run db:seed
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000)

| Perfil | E-mail | Senha |
|--------|--------|-------|
| Despacho | `despacho@logbitts.demo` | `demo1234` |
| Motorista | `motorista@logbitts.demo` | `demo1234` |

## Fluxo do piloto

1. **Despacho** → Entregas (seed já cria 8) → Rotas → selecionar → criar rota → otimizar → publicar  
2. **Torre** → acompanhar progresso no mapa  
3. **Motorista** (`/motorista` ou PWA) → iniciar rota → Waze → check-in → foto + assinatura → POD  

## Postgres externo (Neon / Docker)

```bash
docker compose up -d
```

No `.env`:

```
USE_PGLITE=0
DATABASE_URL=postgresql://logbitts:logbitts@localhost:5432/logbitts
```

Depois: `npm run db:seed`.

## Import CSV (stub ERP)

`POST /api/deliveries/import` com CSV (`Content-Type: text/csv`) ou JSON.

Colunas aceitas: `customer_name`, `address`, `city`, `state`, `zip`, `lat`, `lng`, `external_code`, `weight_kg`, `scheduled_date`, …

## Escopo Fase 1

Inclui: cadastros, entregas, rotas (drag-and-drop + otimização), torre, PWA motorista, POD, fila offline.

Fora: CT-e/MDF-e/CIOT, WMS, marketplace, conector Winthor nativo.

## Scripts

| Script | Função |
|--------|--------|
| `npm run dev` | Dev server |
| `npm run db:seed` | Dados demo |
| `npm run icons` | Ícones PWA |
| `npm run build` | Build produção |
