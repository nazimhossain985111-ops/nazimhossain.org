/* Search results for nazimhossain.org, using the Pagefind index built by build.py. */
const params = new URLSearchParams(location.search);
const query = (params.get("q") || "").trim();
const field = document.getElementById("search-page-input");
const status = document.getElementById("search-status");
const results = document.getElementById("search-results");
field.value = query;

async function run() {
  if (!query) {
    status.textContent = "Type a word or phrase, then press Search.";
    return;
  }
  let pagefind;
  try {
    pagefind = await import("/pagefind/pagefind.js");
  } catch (error) {
    status.textContent = "Search is not available right now. Please try again later.";
    return;
  }
  const search = await pagefind.search(query);
  const found = await Promise.all(search.results.slice(0, 20).map((r) => r.data()));
  status.textContent = found.length
    ? `${found.length} ${found.length === 1 ? "result" : "results"} for "${query}".`
    : `No results for "${query}". Try a different word.`;
  for (const item of found) {
    const li = document.createElement("li");
    const heading = document.createElement("h2");
    const link = document.createElement("a");
    link.href = item.url;
    link.textContent = item.meta.title || item.url;
    heading.appendChild(link);
    const excerpt = document.createElement("p");
    excerpt.innerHTML = item.excerpt;
    li.append(heading, excerpt);
    results.appendChild(li);
  }
  status.focus();
}
run();
