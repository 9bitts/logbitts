# Logbitts — plataforma completa

Open Logistics modular: DMS, WMS, TMS, fiscal, YMS, ERP, multi-CD, 3PL, marketplace, slotting e SEFAZ direto (demo).

## Setup

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

## Módulos

| Fase | Escopo |
|------|--------|
| 1 DMS | Rotas, torre, motorista PWA, POD |
| 2 WMS | Estoque, recebimento, picking, inventário |
| 3 TMS Embarcador | Cotação, embarques, auditoria, faturas |
| 4 Fiscal | CT-e / MDF-e / CIOT (parceiro ou SEFAZ direto) |
| 5 YMS | Docks, agenda, gate |
| 6 ERP | Sync Winthor → entregas |
| 7 Multi-CD + BI | Vários CDs, `/analytics` |
| 8+ | **3PL**, **event lake**, **marketplace**, **slotting**, **cert A1/A3** |

## Atalhos das frentes finais

| Módulo | Rota |
|--------|------|
| Clientes 3PL | `/estoque/clientes-3pl` |
| Slotting | `/estoque/slotting` |
| Marketplace | `/marketplace` |
| Certificados | `/frete/emissao/certificados` |
| Event lake | `/analytics/lake` |

## Deploy (Railway)

Variáveis obrigatórias:

```
DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=<secret ≥32 chars>
BETTER_AUTH_URL=https://logbitts-production.up.railway.app
NEXT_PUBLIC_APP_URL=https://logbitts-production.up.railway.app
```

Opcionais de produção:

```
ALLOW_DEMO_BOOTSTRAP=1          # cria usuários demo no 1º boot (só se quiser)
NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS=1
STORAGE_DRIVER=s3               # POD em R2/S3 (recomendado)
S3_BUCKET=...
S3_ENDPOINT=...
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_PUBLIC_BASE_URL=...
```

Sem `ALLOW_DEMO_BOOTSTRAP`, produção **não** cria usuários demo automaticamente.
Com `STORAGE_DRIVER=local`, fotos de POD somem no redeploy (use volume ou S3).
Fiscal `mock` retorna status `homologacao_mock` — não é autorização SEFAZ.

Para dados completos (rotas, estoque, frete): `npm run db:seed` com `DATABASE_URL` no Postgres (sem `USE_PGLITE=1`).

## Qualidade

```bash
npm run typecheck
npm run lint
npm run test:smoke
npm run build
```
