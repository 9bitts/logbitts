# Logbitts — Fase 4 (DMS + WMS + TMS Embarcador + Fiscal)

Gestão de entregas, armazém, frete embarcador e **emissão fiscal** (CT-e, MDF-e, CIOT) via parceiro.

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
| 2 WMS | Estoque, recebimento, picking, inventário, gate `ready_to_ship` |
| 3 TMS Embarcador | Transportadoras, tabelas, cotação, embarques, auditoria CT-e, faturas |
| 4 Fiscal | Emissão CT-e / MDF-e / CIOT via adapter (mock ou HTTP parceiro) |

## Fluxo frete + fiscal

1. **Frete → Transportadoras / Tabelas**  
2. **Cotação** → **Contratar** embarque  
3. **Emissão fiscal** (`/frete/emissao`) → CT-e do embarque, MDF-e da rota, CIOT (TAC)  
4. **Auditoria** → CT-e de terceiros (import)  
5. **Faturas** → conciliação  
6. **Torre** → OTIF, custo/km, emissões autorizadas / erros  

Provider padrão: **mock** (autoriza em homologação sem SEFAZ). Para parceiro real, configure `http_stub` + `FISCAL_PARTNER_URL` em `/frete/emissao/config`.

## Fora de escopo (ainda)

Marketplace de cargas, Winthor nativo, slotting IA, certificado A1/A3 direto na SEFAZ.
