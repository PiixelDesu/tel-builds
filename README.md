# TEL Builds

Static GitHub Pages site for **The Emerging Light** WvW build matrix.

## Local preview

Because the site loads JSON with `fetch()`, use a tiny local web server rather than opening `index.html` directly.

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## GitHub Pages

1. Push these files to the root of `PiixelDesu/tel-builds`.
2. On GitHub: **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select `main` and `/ (root)`, then Save.
5. The project site will be available at `https://piixeldesu.github.io/tel-builds/`.

No custom domain is configured yet.

## Add/edit builds

Edit `data/builds.json`.

Every profession has these nine slots:

- `power`
- `condi`
- `utility`
- `cloud`
- `zerg`
- `support`
- `pick`
- `bomb`
- `specialist`

A placeholder looks like:

```json
{
  "id": "guardian-power",
  "profession": "guardian",
  "slot": "power",
  "placeholder": true
}
```

Replace it with a full object modeled on `guardian-support`.

