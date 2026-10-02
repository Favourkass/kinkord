/**
 * Structured data (schema.org JSON-LD) that tells search engines who Kinkord
 * is: the organisation behind the site, its earlier names and its accounts.
 * The page passes the facts in; nothing here knows the copy.
 */
export interface SiteFacts {
  url: string;
  name: string;
  description: string;
  logo: string;
  sameAs: readonly string[];
  alternateNames: readonly string[];
}

export function siteJsonLd(f: SiteFacts) {
  const organization = `${f.url}/#organization`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organization,
        name: f.name,
        alternateName: [...f.alternateNames],
        url: `${f.url}/`,
        logo: f.logo,
        description: f.description,
        foundingLocation: { "@type": "Country", name: "Nigeria" },
        sameAs: [...f.sameAs],
      },
      {
        "@type": "WebSite",
        "@id": `${f.url}/#website`,
        url: `${f.url}/`,
        name: f.name,
        description: f.description,
        inLanguage: "en-NG",
        publisher: { "@id": organization },
      },
    ],
  };
}

/** JSON safe to inline in a <script> tag: no "<" in it can close the tag early. */
export function toJsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
