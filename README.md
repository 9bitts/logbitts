# Logbitts — Fase 2 (DMS + WMS)

Gestão de entregas, rotas, torre, app motorista (PWA) **e WMS essencial** (recebimento, estoque, picking, inventário).

## Stack

- Next.js (App Router) + TypeScript
- PostgreSQL via **PGlite embutido** (zero config) ou Neon/Docker
- Drizzle ORM + Better Auth (multi-tenant)
- MapLibre + deep link Waze/Google Maps
- Upload local de POD (`/uploads`)

## Setup rápido

```bash
npm install
cp .env.example .env
npm run icons
npm run db:seed
npm run dev
```

| Perfil | E-mail | Senha |
|--------|--------|-------|
| Despacho | `despacho@logbitts.demo` | `demo1234` |
| Armazém | `armazem@logbitts.demo` | `demo1234` |
| Motorista | `motorista@logbitts.demo` | `demo1234` |

## Fluxo do piloto (Fase 2)

1. **Estoque** → produtos/endereços (seed já cria CD + SKUs + saldos)  
2. **Recebimento** (opcional) → conferir ASN → **App armazém** putaway  
3. **Ondas** → selecionar entregas `pending` → criar → liberar  
4. **App armazém** (`/armazem`) → picking → entrega vira `ready_to_ship`  
5. **Rotas** → montar só com `ready_to_ship` → publicar  
6. **Motorista** → POD em campo  
7. **Inventário** → contagem cíclica ajusta estoque  

## Escopo

**Inclui:** DMS Fase 1 + WMS (warehouse, product, location, stock, receipt, pick wave, cycle count), gate `ready_to_ship` nas rotas.

**Fora:** CT-e/MDF-e/CIOT, slotting IA, multi-CD, 3PL, marketplace, Winthor nativo.

## Scripts

| Script | Função |
|--------|--------|
| `npm run dev` | Dev server |
| `npm run db:seed` | Dados demo (DMS + WMS) |
| `npm run icons` | Ícones PWA |
| `npm run build` | Build produção |
