# Nostos prototype hero QA

Reference: `C:\Users\USER\Downloads\4f6dda2eae11f91fa2fe95a3e176474e.jpg`

Implementation capture: [design-qa-assets/nostos-hero-1440.png](C:\Users\USER\Documents\ideas\botchain-rwa-product\design-qa-assets\nostos-hero-1440.png)

Viewport: 1440 × 900, light theme, production build served locally. The first viewport was compared against the supplied prototype for composition, headline scale, line breaks, CTA treatment, header spacing, collage layering, and whitespace.

Checks completed:

- Header uses the restrained wordmark / centered navigation / right-side wallet action composition; all approved destinations remain linked.
- Hero headline is explicitly set as `Capital` / `on its way` / `home.` in General Sans Medium, with lilac squiggles under the first and last lines.
- Supporting copy and CTA group step inward beneath the headline. The primary action uses a crisp white face with a black offset twin and the secondary action is text-led with a play icon.
- Flow collage uses four code-native artifacts with only truthful labels: Not connected, Verification pending, PENDING, and Registry pending. No addresses, amounts, APYs, ETAs, transaction IDs, balances, or live records are rendered.
- Responsive checks cover 375, 768, 1024, and 1440px widths with no horizontal overflow. Mobile reorders text before the simplified three-card collage and preserves a working drawer.
- Reduced-motion and coarse-pointer paths skip pointer parallax; desktop motion is limited to a short stagger and a few-pixel pointer response.

Result: **passed**. No remaining P0–P2 typography, spacing, color, asset, or responsive mismatches were observed in the first-viewport review.
