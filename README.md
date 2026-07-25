# Lux Rift

**An interactive WebGL experiment where an elastic obsidian membrane opens into dynamic area light, soft penumbra, and inertial motion.**

[Live demo](https://slivenred.github.io/lux-rift/) · [繁體中文](README.zh-TW.md)

![Lux Rift preview](assets/preview.webp)

## Concept

Lux Rift treats darkness as a physical material rather than an empty background. Press and drag across the canvas to stretch open a luminous fracture. The membrane deforms, the edge gains thickness, light spills through a wide penumbra, and the rift keeps moving after release with spring-driven inertia.

The experience combines a real HTML interface with a transparent WebGL layer. The content remains selectable and responsive while the shader handles the membrane, light transport, edge folds, diffraction tint, and exposure.

## Highlights

- Elastic, irregular rifts driven by pointer velocity and drag distance
- Soft area-light falloff with broad penumbra and filmic tone mapping
- Spring, damping, translation, and angular inertia after release
- Multiple light spectra and membrane materials
- Responsive desktop and touch interaction
- Reduced-motion support
- No frameworks, packages, fonts, images, or runtime network requests
- A single self-contained `index.html`

## Controls

| Input | Action |
| --- | --- |
| Press + drag | Pull open and orient a light rift |
| Release | Let the membrane oscillate with inertia |
| Click | Create a short light pulse |
| Double click | Reset the composition |
| Mouse wheel | Adjust exposure |
| `S` | Cycle light spectrum |
| `M` | Cycle membrane material |
| `R` | Reset |
| `+` / `-` | Increase or decrease exposure |

## How it works

Lux Rift uses three layers:

1. **Native DOM** renders the editorial weather archive beneath the effect.
2. **WebGL shader** evaluates signed-distance rift fields, procedural edge noise, membrane folds, thickness, penumbra, diffraction, and exposure.
3. **JavaScript motion system** converts gestures into spring displacement, linear velocity, angular velocity, damping, and decay.

Because the WebGL canvas is transparent and does not receive pointer events, the underlying layout remains regular HTML rather than a rasterized texture.

## Run locally

No build step is required. Open `index.html` directly, or serve the folder locally:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

Run the lightweight repository validation with:

```bash
node scripts/validate.mjs
```

## Project structure

```text
lux-rift/
├── index.html
├── assets/
│   ├── demo.webp
│   ├── mobile.webp
│   └── preview.webp
├── .github/workflows/
│   ├── pages.yml
│   └── validate.yml
├── scripts/validate.mjs
├── CONTRIBUTING.md
├── LICENSE
├── README.md
└── README.zh-TW.md
```

## Customization

The project is intentionally compact. Useful starting points inside `index.html` include:

- CSS variables in `:root` for the editorial surface palette
- `spectrumButton` presets for light color
- `materialButton` presets for membrane color
- `uExposure` for light intensity
- `riftField()` in the fragment shader for edge shape and softness
- the gesture handlers near the end of the script for motion behavior

## Browser support

Lux Rift requires JavaScript and WebGL. It is designed for current desktop and mobile browsers. A clear fallback message is displayed when WebGL cannot be initialized.

## Contributing

Bug reports, interaction ideas, shader improvements, and accessibility fixes are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Released under the [MIT License](LICENSE).

Created by [SlivenRed](https://github.com/slivenred).
