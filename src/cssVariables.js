// Keep these in sync with the CSS variables in globals.css / uno.config.ts
// (ZAPLETANE "Teplo domova" palette). Consumed by Stripe Elements theming in
// CheckoutPage.tsx — plain JS values since Stripe's Elements `variables`
// option can't read CSS custom properties directly.

export const cssVariables = {
  breakpoints: {
    l: 1440,
    m: 1024,
    s: 768,
  },
  colors: {
    base0: 'rgb(255, 255, 255)', // white — field backgrounds
    base100: 'rgb(242, 233, 229)', // brand-100 / gray-100 (#F2E9E5)
    base500: 'rgb(138, 111, 104)', // gray-500 (#8A6F68)
    base850: 'rgb(61, 44, 41)', // gray-800 (#3D2C29)
    base1000: 'rgb(36, 25, 23)', // ink / warm "black" (#241917)
    error500: 'rgb(186, 26, 26)', // error (#BA1A1A)
  },
}
