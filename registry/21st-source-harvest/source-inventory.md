# D3 source inventory

Generated 2026-08-29T08:16:00.777Z from 5205 locally retrieved sources joined to 7949 harvest records. This pass is local-only; it issued no network requests.

**Headline:** 5205 source files are available (65.5% of the corpus). Using the explicit definition “self-contained = no `@/components/ui/<other>` import”, 4008 are self-contained and 1197 import at least one UI sibling.

## Source shape

| Measure | Count |
|---|---:|
| Retrieved source files | 5205 |
| Self-contained by UI-sibling definition | 4008 |
| Files importing `@/components/ui/<other>` | 1197 |
| Files with any local import (alias/relative) | 3016 |
| Unique UI sibling specifiers | 248 |
| UI sibling import edges | 2786 |

## One-hop sibling closure

Resolution is local and conservative: same-author slug matches win; otherwise a unique slug match is used. No sibling network fetches were made.

| Closure status | Edges |
|---|---:|
| ambiguous-slug | 1868 |
| gated-404 | 1 |
| not-in-harvest | 96 |
| page-soft404 | 5 |
| parse-failure | 44 |
| retrieved | 772 |

Resolved retrieved sibling edges: 772; unresolved/not-in-harvest edges: 2014.

## Package usage

| Package | Source files | Import occurrences |
|---|---:|---:|
| react | 4440 | 4897 |
| lucide-react | 1599 | 1630 |
| framer-motion | 1152 | 1156 |
| motion | 394 | 420 |
| class-variance-authority | 281 | 283 |
| next | 270 | 307 |
| clsx | 193 | 194 |
| tailwind-merge | 144 | 144 |
| gsap | 116 | 184 |
| three | 106 | 193 |
| @radix-ui/react-slot | 75 | 75 |
| react-icons | 56 | 80 |
| @react-three/fiber | 51 | 56 |
| next-themes | 50 | 51 |
| @heroui/react | 47 | 51 |
| date-fns | 44 | 45 |
| @ark-ui/react | 43 | 56 |
| recharts | 38 | 46 |
| radix-ui | 38 | 38 |
| reshaped | 36 | 144 |
| @base-ui/react | 36 | 55 |
| react-dom | 36 | 42 |
| @hugeicons/core-free-icons | 33 | 34 |
| @hugeicons/react | 33 | 33 |
| @react-three/drei | 32 | 33 |
| @gsap/react | 31 | 31 |
| @radix-ui/react-dialog | 31 | 31 |
| @paper-design/shaders-react | 31 | 31 |
| ogl | 30 | 30 |
| styled-components | 25 | 25 |

### Package families

| Family | Source files | Import occurrences |
|---|---:|---:|
| react | 4440 | 4939 |
| lucide | 1599 | 1630 |
| motion | 1546 | 1576 |
| class-variance-authority | 281 | 283 |
| next | 270 | 307 |
| radix | 196 | 268 |
| clsx | 193 | 194 |
| tailwind-merge | 144 | 144 |
| gsap | 116 | 184 |
| three | 106 | 193 |
| react-icons | 56 | 80 |
| @react-three/fiber | 51 | 56 |
| next-themes | 50 | 51 |
| @heroui/react | 47 | 51 |
| date-fns | 44 | 45 |
| @ark-ui/react | 43 | 56 |
| recharts | 38 | 46 |
| radix-ui | 38 | 38 |
| reshaped | 36 | 144 |
| @base-ui/react | 36 | 55 |
| hugeicons | 33 | 67 |
| @react-three/drei | 32 | 33 |
| @gsap/react | 31 | 31 |
| @paper-design/shaders-react | 31 | 31 |
| ogl | 30 | 30 |
| styled-components | 25 | 25 |
| @aliimam/icons | 24 | 24 |
| react-aria-components | 23 | 27 |
| reaviz | 20 | 20 |
| @number-flow/react | 19 | 19 |
| @base-ui-components/react | 17 | 23 |
| react-native | 16 | 16 |
| cobe | 16 | 16 |
| react-wrap-balancer | 15 | 15 |
| lenis | 14 | 15 |
| @aliimam/logos | 13 | 13 |
| react-day-picker | 11 | 11 |
| sonner | 10 | 10 |
| @subframe/core | 9 | 14 |
| usehooks-ts | 9 | 9 |
| @remixicon/react | 8 | 8 |
| antd | 7 | 10 |
| react-use-measure | 7 | 7 |
| zod | 7 | 7 |
| react-hook-form | 7 | 7 |
| cmdk | 7 | 7 |
| @phosphor-icons/react | 7 | 7 |
| embla-carousel-react | 7 | 7 |
| uuid | 7 | 7 |
| canvas-confetti | 6 | 8 |
| react-countup | 6 | 6 |
| tailwind-variants | 5 | 8 |
| @hookform/resolvers | 5 | 5 |
| react-intersection-observer | 5 | 5 |
| react-router-dom | 5 | 5 |
| input-otp | 5 | 5 |
| p5 | 5 | 5 |
| @react-spring/web | 5 | 5 |
| @react-three/postprocessing | 5 | 5 |
| @tanstack/react-table | 5 | 5 |
| maplibre-gl | 5 | 5 |
| @dnd-kit/core | 5 | 5 |
| @dnd-kit/sortable | 5 | 5 |
| @dnd-kit/utilities | 5 | 5 |
| moment | 4 | 4 |
| prop-types | 4 | 4 |
| vaul | 4 | 4 |
| react-resizable-panels | 4 | 4 |
| @mui/material | 3 | 18 |
| @dotlottie/react-player | 3 | 5 |
| @headlessui/react | 3 | 4 |
| animejs | 3 | 3 |
| postprocessing | 3 | 3 |
| embla-carousel | 3 | 3 |
| @intentui/icons | 3 | 3 |
| @carbon/icons-react | 3 | 3 |
| remotion | 3 | 3 |
| dotted-map | 3 | 3 |
| react-easy-crop | 3 | 3 |
| csstype | 3 | 3 |
| @glideapps/glide-data-grid | 2 | 6 |
| dialkit | 2 | 4 |
| @embedpdf/core | 2 | 4 |
| @mui/icons-material | 2 | 4 |
| swiper | 2 | 4 |
| mind-elixir | 2 | 4 |
| react-pageflip | 2 | 2 |
| @splinetool/react-spline | 2 | 2 |
| @solana/wallet-adapter-react | 2 | 2 |
| @solana/wallet-adapter-base | 2 | 2 |
| uvcanvas | 2 | 2 |
| unicornstudio-react | 2 | 2 |
| @ant-design/icons | 2 | 2 |
| shiki | 2 | 2 |
| lucide-react-native | 2 | 2 |
| embla-carousel-autoplay | 2 | 2 |
| tone | 2 | 2 |
| react-dropzone | 2 | 2 |
| @embedpdf/models | 2 | 2 |
| @embedpdf/plugin-document-manager | 2 | 2 |
| @embedpdf/plugin-interaction-manager | 2 | 2 |
| @embedpdf/plugin-render | 2 | 2 |
| @embedpdf/plugin-rotate | 2 | 2 |
| @embedpdf/plugin-scroll | 2 | 2 |
| @embedpdf/plugin-search | 2 | 2 |
| @embedpdf/plugin-selection | 2 | 2 |
| @embedpdf/plugin-thumbnail | 2 | 2 |
| @embedpdf/plugin-tiling | 2 | 2 |
| @embedpdf/plugin-viewport | 2 | 2 |
| @embedpdf/plugin-zoom | 2 | 2 |
| pdf-lib | 2 | 2 |
| @tsparticles/engine | 2 | 2 |
| @tsparticles/react | 2 | 2 |
| tweakpane | 2 | 2 |
| @heroicons/react | 2 | 2 |
| @studio-freight/lenis | 2 | 2 |
| @tabler/icons-react | 2 | 2 |
| @headless-tree/core | 2 | 2 |
| react-syntax-highlighter | 2 | 2 |
| react-tooltip | 2 | 2 |
| ace-builds | 1 | 18 |
| @rsuite/icons | 1 | 5 |
| hls.js | 1 | 3 |
| zustand | 1 | 3 |
| @tigerabrodioss/fude | 1 | 3 |
| slot-text | 1 | 2 |
| react-medium-image-zoom | 1 | 2 |
| @pierre/diffs | 1 | 2 |
| @pierre/trees | 1 | 2 |
| react-resizable | 1 | 2 |
| leaflet | 1 | 2 |
| @tiptap/react | 1 | 2 |
| react-payment-inputs | 1 | 2 |
| @chakra-ui/react | 1 | 2 |
| react-phone-number-input | 1 | 2 |
| html-to-image | 1 | 1 |
| @solana/web3.js | 1 | 1 |
| @solana/wallet-adapter-react-ui | 1 | 1 |
| @solana/wallet-adapter-backpack | 1 | 1 |
| @solana/wallet-adapter-wallets | 1 | 1 |
| react-pixelart-face-card | 1 | 1 |
| color-bits | 1 | 1 |
| qr-code-styling | 1 | 1 |
| react-pdf | 1 | 1 |
| react-barcode | 1 | 1 |
| html2canvas | 1 | 1 |
| @iconify/react | 1 | 1 |
| @fortawesome/react-fontawesome | 1 | 1 |
| @fortawesome/free-solid-svg-icons | 1 | 1 |
| @fortawesome/fontawesome-svg-core | 1 | 1 |
| @react-hook/media-query | 1 | 1 |
| react-ace | 1 | 1 |
| fmt | 1 | 1 |
| cnippet-aos | 1 | 1 |
| react-player | 1 | 1 |
| @chenglou/pretext | 1 | 1 |
| heroui-native | 1 | 1 |
| @use-gesture/react | 1 | 1 |
| Component | 1 | 1 |
| mathjs | 1 | 1 |
| gl-matrix | 1 | 1 |
| use-scramble | 1 | 1 |
| stats.js | 1 | 1 |
| react-markdown | 1 | 1 |
| emojibase | 1 | 1 |
| @avenra/liquid-glass | 1 | 1 |
| d3-delaunay | 1 | 1 |
| vecteur | 1 | 1 |
| papaparse | 1 | 1 |
| border-beam | 1 | 1 |
| @embedpdf/engines | 1 | 1 |
| @extend-ai/react-xlsx | 1 | 1 |
| tsparticles | 1 | 1 |
| media-chrome | 1 | 1 |
| flubber | 1 | 1 |
| @paper-design/shaders | 1 | 1 |
| react-spring | 1 | 1 |
| react-confetti | 1 | 1 |
| react-leaflet | 1 | 1 |
| react-leaflet-cluster | 1 | 1 |
| react-error-boundary | 1 | 1 |
|  | 1 | 1 |
| gradflow | 1 | 1 |
| swr | 1 | 1 |
| d3 | 1 | 1 |
| @ncdai/react-wheel-picker | 1 | 1 |
| @tiptap/starter-kit | 1 | 1 |
| @tiptap/extension-underline | 1 | 1 |
| @tiptap/extension-link | 1 | 1 |
| @tiptap/extension-placeholder | 1 | 1 |
| @origin-space/image-cropper | 1 | 1 |
| emblor | 1 | 1 |
| @phucbm/magnetic-button | 1 | 1 |
| normalized-mouse-position | 1 | 1 |
| @phucbm/ripple-effect | 1 | 1 |
| @platejs/caption | 1 | 1 |
| @udecode/cn | 1 | 1 |
| frimousse | 1 | 1 |
| gasp | 1 | 1 |
| react-textarea-autosize | 1 | 1 |
| 0 0 40 40 | 1 | 1 |
| qrcode.react | 1 | 1 |
| use-sound | 1 | 1 |
| lottie-web | 1 | 1 |
| jsonwebtoken | 1 | 1 |
| bcrypt | 1 | 1 |
| md5 | 1 | 1 |
| @internationalized/date | 1 | 1 |
| @dnd-kit/modifiers | 1 | 1 |
| embla-carousel-auto-scroll | 1 | 1 |
| @mui/x-data-grid | 1 | 1 |
| rsuite | 1 | 1 |
| date-fns-tz | 1 | 1 |
| @reach/portal | 1 | 1 |
| @tanstack/react-virtual | 1 | 1 |
| @zumer/snapdom | 1 | 1 |
| nanoid | 1 | 1 |
| react-hotkeys-hook | 1 | 1 |
| qrcode | 1 | 1 |
| react-tweet | 1 | 1 |
| @icons-pack/react-simple-icons | 1 | 1 |
| swapy | 1 | 1 |
| @motionone/utils | 1 | 1 |
| @tsparticles/slim | 1 | 1 |
| @uiw/color-convert | 1 | 1 |
| @uiw/react-color-hue | 1 | 1 |
| @uiw/react-color-saturation | 1 | 1 |
| ai | 1 | 1 |
| leva | 1 | 1 |
| maath | 1 | 1 |
| daisyui | 1 | 1 |
| @uidotdev/usehooks | 1 | 1 |
| figma:react | 1 | 1 |

## 75-tag family join

Counts below join each retrieved source to the existing classification by upstream URL. Components are allowed to appear in multiple families.

| Tag/family | Corpus members | Retrieved source | Source coverage | CDN 404-gated | Other unavailable |
|---|---:|---:|---:|---:|---:|
| accordion | 198 | 137 | 69.2% | 9 | 52 |
| ai-chat | 203 | 88 | 43.3% | 52 | 63 |
| alert | 175 | 104 | 59.4% | 38 | 33 |
| announcement | 74 | 33 | 44.6% | 16 | 25 |
| avatar | 244 | 153 | 62.7% | 49 | 42 |
| background | 679 | 214 | 31.5% | 428 | 37 |
| badge | 236 | 156 | 66.1% | 32 | 48 |
| border | 149 | 82 | 55.0% | 31 | 36 |
| button | 441 | 340 | 77.1% | 29 | 72 |
| calendar | 158 | 120 | 75.9% | 11 | 27 |
| card | 613 | 510 | 83.2% | 47 | 56 |
| carousel | 310 | 227 | 73.2% | 35 | 48 |
| checkbox | 176 | 119 | 67.6% | 7 | 50 |
| chip | 55 | 31 | 56.4% | 6 | 18 |
| clients | 22 | 12 | 54.5% | 6 | 4 |
| comparison | 42 | 26 | 61.9% | 6 | 10 |
| cta | 213 | 165 | 77.5% | 20 | 28 |
| cursor | 190 | 105 | 55.3% | 34 | 51 |
| dashboard | 343 | 252 | 73.5% | 13 | 78 |
| data-visualization | 258 | 184 | 71.3% | 18 | 56 |
| date-picker | 178 | 145 | 81.5% | 1 | 32 |
| dock | 89 | 62 | 69.7% | 8 | 19 |
| dropdown | 205 | 146 | 71.2% | 16 | 43 |
| empty-state | 186 | 131 | 70.4% | 19 | 36 |
| faq | 93 | 70 | 75.3% | 4 | 19 |
| features | 308 | 214 | 69.5% | 46 | 48 |
| file-tree | 53 | 36 | 67.9% | 9 | 8 |
| footer | 198 | 130 | 65.7% | 25 | 43 |
| form | 163 | 133 | 81.6% | 10 | 20 |
| gallery | 323 | 219 | 67.8% | 50 | 54 |
| globe | 42 | 36 | 85.7% | 3 | 3 |
| grid | 366 | 241 | 65.8% | 63 | 62 |
| hero | 517 | 414 | 80.1% | 59 | 44 |
| hook | 60 | 20 | 33.3% | 9 | 31 |
| icon | 293 | 193 | 65.9% | 30 | 70 |
| image | 310 | 196 | 63.2% | 68 | 46 |
| input | 213 | 154 | 72.3% | 20 | 39 |
| link | 170 | 121 | 71.2% | 8 | 41 |
| list | 174 | 133 | 76.4% | 17 | 24 |
| map | 52 | 30 | 57.7% | 13 | 9 |
| marquee | 136 | 74 | 54.4% | 32 | 30 |
| menu | 269 | 171 | 63.6% | 35 | 63 |
| modal | 270 | 195 | 72.2% | 15 | 60 |
| navigation-menu | 320 | 223 | 69.7% | 36 | 61 |
| notification | 192 | 121 | 63.0% | 40 | 31 |
| number | 87 | 47 | 54.0% | 18 | 22 |
| onboarding | 73 | 52 | 71.2% | 13 | 8 |
| pagination | 74 | 50 | 67.6% | 7 | 17 |
| popover | 191 | 121 | 63.4% | 10 | 60 |
| pricing-section | 185 | 134 | 72.4% | 21 | 30 |
| profile | 211 | 160 | 75.8% | 13 | 38 |
| progress | 171 | 117 | 68.4% | 32 | 22 |
| radio-group | 70 | 55 | 78.6% | 4 | 11 |
| scroll-area | 337 | 217 | 64.4% | 42 | 78 |
| search | 122 | 90 | 73.8% | 9 | 23 |
| select | 152 | 98 | 64.5% | 23 | 31 |
| sidebar | 139 | 74 | 53.2% | 7 | 58 |
| sign-in | 139 | 103 | 74.1% | 22 | 14 |
| sign-up | 93 | 64 | 68.8% | 16 | 13 |
| slider | 264 | 198 | 75.0% | 25 | 41 |
| spinner | 434 | 251 | 57.8% | 133 | 50 |
| stat | 153 | 103 | 67.3% | 31 | 19 |
| steps | 65 | 45 | 69.2% | 11 | 9 |
| table | 180 | 112 | 62.2% | 37 | 31 |
| tabs | 180 | 120 | 66.7% | 14 | 46 |
| team | 91 | 73 | 80.2% | 5 | 13 |
| testimonials | 134 | 89 | 66.4% | 27 | 18 |
| text | 439 | 265 | 60.4% | 87 | 87 |
| textarea | 219 | 143 | 65.3% | 14 | 62 |
| timeline | 133 | 106 | 79.7% | 14 | 13 |
| toast | 50 | 32 | 64.0% | 14 | 4 |
| toggle | 282 | 203 | 72.0% | 29 | 50 |
| tooltip | 244 | 167 | 68.4% | 19 | 58 |
| untagged | 670 | 498 | 74.3% | 82 | 90 |
| upload-download | 132 | 93 | 70.5% | 20 | 19 |
| video | 141 | 61 | 43.3% | 72 | 8 |

## Interpretation and limits

- This inventory measures source that the harvester actually retrieved; it does not infer source from compiled bundles or demos.
- “Self-contained” is intentionally narrow and structural: it only means no `@/components/ui/<other>` import. External packages and relative utility imports may still be present.
- One-hop closure records whether a sibling slug maps to a locally retrieved/gated/unavailable component. It does not claim that a missing slug cannot exist outside this 7,949-record harvest.
- Per-file details, exact imports, package names, tags, and sibling closure records are in `source-inventory.jsonl`; aggregate machine data is in `source-inventory-summary.json`.
