# Mono Documentation — content

This repository holds the **content** for [docs.mono.si](https://docs.mono.si): plain
Markdown and images. You do **not** need Node, Astro, or any build tools to contribute.

The site is rendered by a separate builder repo (`docs-site`), which pulls this content
in at build time. You never have to touch it.

## Layout

```
index.md                     home page
gateway-development-kit/*.md  one page per file
tutorials/*.md                one page per file
assets/                       images, PDFs, etc. (referenced as /assets/…)
```

## Contributing

1. Edit or add a `.md` file in `gateway-development-kit/` or `tutorials/`.
2. Every page starts with frontmatter:
   ```yaml
   ---
   title: "Getting started"          # page title (required)
   section: "Gateway development kit" # sidebar group (required)
   order: 1                           # position within the group (required)
   ---
   ```
3. Write standard Markdown below it. Open a pull request.

### Images

Put image files in `assets/` and reference them with an absolute path:

```markdown
![Development Kit ports](/assets/development-kit-backpanel-connectors.png)
```

### Callouts

Use fenced directives — no HTML, no imports:

```markdown
:::note
General information.
:::

:::tip
A helpful suggestion.
:::

:::warning
Something to be careful about.
:::

:::danger
A destructive or dangerous action.
:::
```

(`:::info` is accepted as an alias for `:::note`.)

### Code blocks

Tag every code block with a language so it gets syntax highlighting:

````markdown
```sh
apk add curl
```
````

## Where does it go live?

Merges to `main` trigger the `docs-site` builder, which rebuilds and deploys to
docs.mono.si. There is nothing to run here.
