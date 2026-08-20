# Portfolio Images

Add your makeup photos here, then add an entry to `../data/portfolio.json`.

## How to add a new photo

1. **Save the image** in this folder with a descriptive name:
   - Use lowercase, hyphens instead of spaces: `bridal-soft-glam.jpg`
   - Recommended size: 800×1000px (portrait 4:5) or 800×600px (landscape 4:3)
   - Keep file size under ~300KB for fast loading

2. **Add an entry** to `data/portfolio.json` inside the `"portfolio": []` array:

```json
{
  "img": "images/portfolio/bridal-soft-glam.jpg",
  "alt": "Soft bridal glam makeup with warm tones",
  "category": "Bridal",
  "title": "Timeless Elegance",
  "featured": false
}
```

## Schema

| Field      | Type    | Required | Notes                                               |
|------------|---------|----------|-----------------------------------------------------|
| `img`      | string  | yes      | Path relative to site root, e.g. `images/portfolio/photo.jpg` |
| `alt`      | string  | yes      | Descriptive alt text for accessibility & SEO         |
| `category` | string  | yes      | Category label shown on hover (e.g. Bridal, Editorial) |
| `title`    | string  | yes      | Display title shown on hover                         |
| `featured` | boolean | no       | Set `true` for one item to span 2 columns (optional) |

## Tips

- Only one item should have `"featured": true`.
- The first 4 images load eagerly; the rest lazy-load for performance.
- Refresh the browser to see changes (no build step required).
