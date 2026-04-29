/**
 * Try multiple strategies to find a free PDF URL for a paper, in order:
 *
 *   1. arXiv URL transform (abs/X → pdf/X.pdf)
 *   2. Unpaywall (free OA index covering ~30M papers, requires an email
 *      address but no API key — see https://unpaywall.org/products/api)
 *   3. Semantic Scholar `openAccessPdf.url` field
 *   4. arXiv title search (catches journal papers that also have arXiv preprints)
 *
 * Returns null only when none of the strategies succeed, in which case the
 * caller should ask the user to upload the PDF manually.
 */

interface Paper {
  title: string;
  doi: string | null;
  url: string | null;
  source: string;
}

const UNPAYWALL_EMAIL = process.env.UNPAYWALL_EMAIL || "rd-engine@dnhsechapps.com";

async function fetchJson<T>(url: string, timeoutMs = 8000): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "RDResearchEngine/1.0 (+https://github.com/arnavm49-netizen/rd-research-engine)",
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) return null;
    return (await resp.json()) as T;
  } catch {
    return null;
  }
}

function arxivPdfFromAbsUrl(url: string): string | null {
  const match = url.match(/arxiv\.org\/abs\/([\w./-]+)/);
  if (!match) return null;
  // Strip trailing version letter if present (we want the canonical PDF)
  return `https://arxiv.org/pdf/${match[1]}.pdf`;
}

async function viaArxivUrlTransform(paper: Paper): Promise<string | null> {
  const url = paper.url || "";
  if (paper.source === "arxiv" || url.includes("arxiv.org")) {
    return arxivPdfFromAbsUrl(url);
  }
  return null;
}

interface UnpaywallResponse {
  best_oa_location?: { url_for_pdf?: string | null; url?: string | null };
  oa_locations?: { url_for_pdf?: string | null; url?: string | null }[];
}

async function viaUnpaywall(paper: Paper): Promise<string | null> {
  if (!paper.doi) return null;
  const cleanDoi = paper.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  const data = await fetchJson<UnpaywallResponse>(
    `https://api.unpaywall.org/v2/${encodeURIComponent(cleanDoi)}?email=${encodeURIComponent(UNPAYWALL_EMAIL)}`,
  );
  if (!data) return null;

  const best = data.best_oa_location;
  if (best?.url_for_pdf) return best.url_for_pdf;

  // Fall back through the location list looking for any PDF
  for (const loc of data.oa_locations || []) {
    if (loc.url_for_pdf) return loc.url_for_pdf;
  }

  // Last resort: a non-PDF landing page that we won't try to ingest
  return null;
}

interface SemanticScholarResponse {
  openAccessPdf?: { url?: string | null } | null;
  externalIds?: { ArXiv?: string | null } | null;
}

async function viaSemanticScholarOA(paper: Paper): Promise<string | null> {
  if (!paper.doi && paper.source !== "semantic_scholar") return null;
  const lookup = paper.doi ? `DOI:${paper.doi}` : null;
  if (!lookup) return null;

  const data = await fetchJson<SemanticScholarResponse>(
    `https://api.semanticscholar.org/graph/v1/paper/${encodeURIComponent(lookup)}?fields=openAccessPdf,externalIds`,
  );
  if (!data) return null;

  if (data.openAccessPdf?.url) return data.openAccessPdf.url;

  // If S2 knows about an arXiv preprint of this paper, use that
  const arxivId = data.externalIds?.ArXiv;
  if (arxivId) return `https://arxiv.org/pdf/${arxivId}.pdf`;

  return null;
}

interface ArxivSearchEntry {
  id?: string;
}

async function viaArxivTitleSearch(paper: Paper): Promise<string | null> {
  // Fall back: search arXiv by exact title. Useful when a journal paper has
  // an arXiv preprint but the discovery source didn't link it.
  const title = (paper.title || "").trim();
  if (title.length < 12) return null;

  // arXiv API returns Atom XML, but we just need the entry id. A simple
  // text search is fine — quote the title to bias toward exact match.
  const query = encodeURIComponent(`ti:"${title}"`);
  try {
    const resp = await fetch(
      `https://export.arxiv.org/api/query?search_query=${query}&max_results=1`,
      {
        headers: { "User-Agent": "RDResearchEngine/1.0" },
      },
    );
    if (!resp.ok) return null;
    const xml = await resp.text();
    // Extract first <id>http://arxiv.org/abs/...</id>
    const match = xml.match(/<id>(http[^<]+arxiv\.org\/abs\/[^<]+)<\/id>/);
    if (!match) return null;
    return arxivPdfFromAbsUrl(match[1]);
  } catch {
    return null;
  }
}

export interface LocatedPdf {
  url: string;
  strategy: string;
}

/**
 * Locate a PDF URL for the given paper using all available strategies.
 * Returns null only when every strategy fails.
 */
export async function locatePdf(paper: Paper): Promise<LocatedPdf | null> {
  const strategies: { name: string; fn: () => Promise<string | null> }[] = [
    { name: "arxiv-url-transform", fn: () => viaArxivUrlTransform(paper) },
    { name: "unpaywall", fn: () => viaUnpaywall(paper) },
    { name: "semantic-scholar-oa", fn: () => viaSemanticScholarOA(paper) },
    { name: "arxiv-title-search", fn: () => viaArxivTitleSearch(paper) },
  ];

  for (const { name, fn } of strategies) {
    const url = await fn();
    if (url) return { url, strategy: name };
  }
  return null;
}
