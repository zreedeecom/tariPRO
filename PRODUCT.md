# Product

<!-- impeccable:product-schema 1 -->

## Platform
Desktop app for macOS and Windows (Electron, planned in specs/002-escritorio). Today a local web app served on 127.0.0.1.

## Stack
Node.js local server, buildless HTML/CSS/JavaScript, JSON snapshots on disk, native PDF writer. No runtime dependencies.

## Users
Luis (Impress) manages his professional printing tariff from a Mac and a Windows PC, one at a time. Later, other sign makers and print shops may use it for their own tariffs.

## Product Purpose
Edit material and finish costs, see the impact on selling prices before saving, choose margins or fixed prices, save deliberate versions and produce a printable A4 tariff.

## Capabilities and Constraints
Materials and finishes are editable without code changes. Costs keep full precision; unknown costs stay unknown, never zero. Suggested prices and chosen selling prices are separate. Every save is an immutable version. Supplier costs are confidential and never appear in the PDF or the repository.

## Brand Commitments
Spanish interface. Impress identity in the PDF: black, orange and clear commercial tables, A4. A customizable brand for other users is planned, not built.

## Product Principles
- Show the proposed price beside the saved price before committing changes.
- Explain costs, assumptions and incomplete margins.
- Keep ordinary catalog changes possible from the interface.
- Drafts are safe to experiment with; saving is deliberate.
