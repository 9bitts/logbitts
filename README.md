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

## Notas

- Certificado A1/A3 é **stub de homologação** (fingerprint + ativação → `sefaz_direct`); não armazena chave privada nem fala com SEFAZ real.
- Marketplace e 3PL são MVPs operacionais no mesmo tenant.
- Event lake grava `domain_event` para export JSON / BI.
