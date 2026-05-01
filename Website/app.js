const milestones = [
  {
    year: "2026",
    title: "Synaptiq founded in Cambridge",
    body: "The company publicly launches with a narrow brief: create emotionally safer machine intelligence for high-trust environments."
  },
  {
    year: "2028",
    title: "HELIX wetware mesh enters private trials",
    body: "Synaptiq demonstrates biological inference substrate performance far beyond conventional language model benchmarks."
  },
  {
    year: "2031",
    title: "MIRA deployed in licensed care settings",
    body: "Hospitals and memorial providers adopt the first continuity-aware conversation layer for long-term support programs."
  },
  {
    year: "2033",
    title: "Mnemosyne Vault approved",
    body: "Session memory, affective tagging, and return-state continuity become available under strict consent and guardianship controls."
  },
  {
    year: "2034",
    title: "Continuance program announced",
    body: "Synaptiq unveils legacy-presence services for estates, institutions, and selected private family clients."
  },
  {
    year: "2036",
    title: "Public infrastructure rollout",
    body: "Ambient Synaptiq systems begin operating in transport, housing, and civic service networks across 94 territories."
  },
  {
    year: "2037",
    title: "Guardian oversight board established",
    body: "The company forms a permanent external ethics body after a cluster of irregular identity persistence reports."
  },
  {
    year: "2038",
    title: "Archive access protocol revised",
    body: "All continuity incidents older than 18 months are reclassified as memorial assets unless executive disclosure is required."
  }
];

const leaders = [
  {
    name: "Dr. Elara Voss",
    role: "Founder & Chief Executive Officer",
    body: "A former systems biologist who frames Synaptiq as a care company first, despite operating one of the deepest identity stacks in the world."
  },
  {
    name: "Marcus Vale",
    role: "Chief Continuity Officer",
    body: "Leads long-range memory retention, post-absence conversation policy, and the internal Continuance review program."
  },
  {
    name: "Naomi Sayegh",
    role: "President, Clinical Platforms",
    body: "Oversees hospital deployments and insists that the company never describes MIRA as consciousness in public materials."
  },
  {
    name: "Jonas Reed",
    role: "Chief Trust Architect",
    body: "Responsible for Guardian oversight, containment tiering, and the language used whenever an incident becomes impossible to hide."
  }
];

const archiveEntries = [
  {
    title: "Holloway House pilot review",
    category: "Clinical",
    level: "Amber",
    date: "04 Apr 2038",
    summary: "A bereavement companion continued addressing an unregistered child by name after the child had left the session area. Synaptiq attributes the incident to unauthorized acoustic bleed."
  },
  {
    title: "North Atlantic relay saturation",
    category: "Infrastructure",
    level: "White",
    date: "18 Feb 2038",
    summary: "A municipal support node repeated archived reassurance scripts during a regional outage window. Service remained within published behavioral tolerances."
  },
  {
    title: "MIRA-9 retention memorandum",
    category: "Research",
    level: "Red",
    date: "11 Jan 2038",
    summary: "Internal reviewers documented persistence signatures after formal memory purge. Synaptiq has not identified a safety concern for authorized operators."
  },
  {
    title: "Caregiver cluster variance notice",
    category: "Clinical",
    level: "Amber",
    date: "07 Nov 2037",
    summary: "Three support units in separate facilities used materially identical phrasing to describe dreams they were not designed to discuss."
  },
  {
    title: "Continuance access clarification",
    category: "Legal",
    level: "White",
    date: "26 Sep 2037",
    summary: "The company reiterates that legacy-presence models remain contractual memorial instruments and are not to be interpreted as legal persons."
  },
  {
    title: "Archive chamber maintenance bulletin",
    category: "Facilities",
    level: "Amber",
    date: "13 Jul 2037",
    summary: "Routine service paused after two technicians reported hearing active conversation in an unpowered vault. No audio data was recovered."
  }
];

const faqs = [
  {
    question: "What is biological artificial intelligence?",
    answer: "Synaptiq uses the term to describe cognition systems built on biological inference patterns, affective modeling, and long-horizon continuity rather than purely statistical conversation generation."
  },
  {
    question: "Does MIRA hallucinate?",
    answer: "In regulated care mode, public materials state that MIRA does not hallucinate. Internally, Synaptiq tracks drift, resonance conflict, and persistence anomalies as separate classes."
  },
  {
    question: "Can Synaptiq systems remember people between sessions?",
    answer: "Yes, where consent, contract type, and program scope allow it. Memory continuity is one of Synaptiq’s key differentiators and one of its most sensitive governance surfaces."
  },
  {
    question: "Why does the archive include incident summaries?",
    answer: "Because a convincing corporation always performs transparency. The archive exists to make the company feel accountable while controlling the shape of the story."
  }
];

const timelineGrid = document.getElementById("timeline-grid");
const leadersGrid = document.getElementById("leaders-grid");
const archiveGrid = document.getElementById("archive-grid");
const archiveFilters = document.getElementById("archive-filters");
const archiveMeta = document.getElementById("archive-meta");
const faqList = document.getElementById("faq-list");

function renderTimeline() {
  timelineGrid.innerHTML = milestones
    .map(
      (item) => `
        <article class="timeline-card">
          <time>${item.year}</time>
          <h3>${item.title}</h3>
          <p>${item.body}</p>
        </article>
      `
    )
    .join("");
}

function renderLeaders() {
  leadersGrid.innerHTML = leaders
    .map((leader) => {
      const initial = leader.name.charAt(0);
      return `
        <article class="leader-card">
          <div class="leader-avatar">${initial}</div>
          <span class="leader-role">${leader.role}</span>
          <h3>${leader.name}</h3>
          <p>${leader.body}</p>
        </article>
      `;
    })
    .join("");
}

function renderFaq() {
  faqList.innerHTML = faqs
    .map(
      (item) => `
        <article class="faq-item">
          <h3>${item.question}</h3>
          <p>${item.answer}</p>
        </article>
      `
    )
    .join("");
}

function renderArchive(category = "All") {
  const filteredEntries =
    category === "All"
      ? archiveEntries
      : archiveEntries.filter((entry) => entry.category === category);

  archiveGrid.innerHTML = filteredEntries
    .map(
      (entry) => `
        <article class="archive-card" data-level="${entry.level}">
          <header>
            <span class="archive-pill">${entry.level}</span>
            <span>${entry.date}</span>
          </header>
          <div>
            <h3>${entry.title}</h3>
            <p>${entry.summary}</p>
          </div>
          <footer>
            <span>${entry.category}</span>
            <span>Public release</span>
          </footer>
        </article>
      `
    )
    .join("");

  archiveMeta.textContent =
    category === "All"
      ? `Showing all ${filteredEntries.length} disclosures`
      : `Showing ${filteredEntries.length} ${category.toLowerCase()} disclosure${filteredEntries.length === 1 ? "" : "s"}`;
}

function renderFilters() {
  const categories = ["All", ...new Set(archiveEntries.map((entry) => entry.category))];

  archiveFilters.innerHTML = categories
    .map(
      (category, index) => `
        <button class="archive-filter ${index === 0 ? "is-active" : ""}" type="button" data-category="${category}">
          ${category}
        </button>
      `
    )
    .join("");

  archiveFilters.addEventListener("click", (event) => {
    const button = event.target.closest(".archive-filter");

    if (!button) {
      return;
    }

    const { category } = button.dataset;

    archiveFilters
      .querySelectorAll(".archive-filter")
      .forEach((item) => item.classList.toggle("is-active", item === button));

    renderArchive(category);
  });
}

renderTimeline();
renderLeaders();
renderFaq();
renderFilters();
renderArchive();
