import { docs } from '@/.source';
import { loader } from 'fumadocs-core/source';
import { icons } from "lucide-react";
import { createElement } from 'react';

// `loader()` also assign a URL to your pages
// See https://fumadocs.vercel.app/docs/headless/source-api for more info
export const source = loader({
  baseUrl: '/',
  source: docs.toFumadocsSource(),
  icon(icon) {
    console.log("Trying to load icon", icon);
    if (icon && icon in icons)
      return createElement(icons[icon as keyof typeof icons]);
  },
});
