const novel = document.getElementById("novel");
const progressBar = document.getElementById("progressBar");
const deviceScroll = document.getElementById("deviceScroll");
const menuToggle = document.getElementById("menuToggle");
const menuBackdrop = document.getElementById("menuBackdrop");
const chapterMenu = document.getElementById("chapterMenu");
const chapterMenuList = document.getElementById("chapterMenuList");

const story = window.STORY_DATA;

let sceneElements = [];
let activeSceneIndex = 0;
let ticking = false;
let talkTargets = [];
let sceneMidpoints = [];
let talkOffsets = [];
let currentTalkKey = null;
let talkLinkElements = [];

function stripLeadingLabel(title, label) {
  if (typeof title !== "string" || !title) {
    return "";
  }

  if (title.startsWith(label)) {
    return title.slice(label.length).replace(/^[\s　]+/, "") || title;
  }

  return title;
}

function lineElement(text) {
  const paragraph = document.createElement("p");
  paragraph.className = "beat-line";
  paragraph.textContent = text;
  return paragraph;
}

function beatElement(beat, beatIndex) {
  const article = document.createElement("article");
  article.className = `beat beat-${beat.kind}`;
  article.dataset.beatIndex = String(beatIndex);

  const inner = document.createElement("div");
  inner.className = "beat-inner";
  inner.append(lineElement(beat.rawText));

  article.append(inner);
  return article;
}

function chapterMarker(scene) {
  const section = document.createElement("section");
  section.className = "chapter-marker";
  section.id = `talk-${scene.talkKey}`;
  section.dataset.talkKey = scene.talkKey;

  const chapterRow = document.createElement("div");
  chapterRow.className = "chapter-marker-row";

  const label = document.createElement("p");
  label.className = "chapter-marker-index";
  label.textContent = scene.chapterLabel;

  const title = document.createElement("h2");
  title.className = "chapter-marker-title";
  title.textContent = stripLeadingLabel(scene.chapterTitle, scene.chapterLabel);

  const talkRow = document.createElement("div");
  talkRow.className = "chapter-marker-talk-row";

  const talkLabel = document.createElement("p");
  talkLabel.className = "chapter-marker-talk-index";
  talkLabel.textContent = scene.talkLabel;

  const talkTitle = document.createElement("p");
  talkTitle.className = "chapter-marker-talk-title";
  talkTitle.textContent = stripLeadingLabel(scene.talkTitle, scene.talkLabel);

  chapterRow.append(label, title);
  talkRow.append(talkLabel, talkTitle);
  section.append(chapterRow, talkRow);
  return section;
}

function titlePage(storyData) {
  const section = document.createElement("section");
  section.className = "title-page";

  const card = document.createElement("div");
  card.className = "title-page-card";

  const eyebrow = document.createElement("p");
  eyebrow.className = "title-page-eyebrow";
  eyebrow.textContent = "Illustrated Web Novel";

  const heading = document.createElement("h1");
  heading.className = "title-page-title";
  if (Array.isArray(storyData.titleDisplayLines) && storyData.titleDisplayLines.length > 0) {
    heading.append(
      ...storyData.titleDisplayLines.map((line, index) => {
        const span = document.createElement("span");
        span.className = line ? "title-page-title-line" : "title-page-title-spacer";
        if (line) {
          span.dataset.lineIndex = String(index);
          if (line.length > 18) {
            span.classList.add("is-long");
          }
        }
        span.textContent = line || " ";
        return span;
      }),
    );
  } else {
    heading.textContent = storyData.title;
  }

  if (storyData.titleImage) {
    const artWrap = document.createElement("div");
    artWrap.className = "title-page-art";

    const art = document.createElement("img");
    art.className = "title-page-image";
    art.src = storyData.titleImage;
    art.alt = storyData.titleImageAlt || storyData.title;
    art.loading = "eager";
    art.decoding = "async";

    const overlay = document.createElement("div");
    overlay.className = "title-page-overlay";
    overlay.append(eyebrow, heading);

    artWrap.append(art, overlay);
    card.append(artWrap);
  } else {
    card.append(eyebrow, heading);
  }

  const meta = document.createElement("p");
  meta.className = "title-page-meta";
  meta.textContent = `${storyData.talkCount ?? storyData.sceneCount}話収録`;

  card.append(meta);
  section.append(card);
  return section;
}

function chapterMenuItem(scene, index) {
  const button = document.createElement("button");
  button.className = "chapter-link";
  button.type = "button";
  button.dataset.talkKey = scene.talkKey;
  button.innerHTML = `
    <span class="chapter-link-talk-index">${scene.talkLabel}</span>
    <span class="chapter-link-talk-title">${stripLeadingLabel(scene.talkTitle, scene.talkLabel)}</span>
  `;
  button.addEventListener("click", () => {
    const target = talkTargets.find((item) => item.talkKey === scene.talkKey);
    if (target) {
      deviceScroll.scrollTo({
        top: Math.max(0, target.element.offsetTop - 12),
        behavior: "smooth",
      });
    }
    setMenuOpen(false);
  });
  if (index === 0) {
    button.classList.add("is-current");
  }
  return button;
}

function chapterMenuGroup(chapterScene, talkScenes, startIndex) {
  const section = document.createElement("section");
  section.className = "chapter-menu-group";

  const header = document.createElement("div");
  header.className = "chapter-menu-group-header";
  header.innerHTML = `
    <p class="chapter-menu-group-index">${chapterScene.chapterLabel}</p>
    <h3 class="chapter-menu-group-title">${stripLeadingLabel(chapterScene.chapterTitle, chapterScene.chapterLabel)}</h3>
  `;

  const list = document.createElement("div");
  list.className = "chapter-menu-group-list";
  const buttons = talkScenes.map((scene, index) => chapterMenuItem(scene, startIndex + index));
  list.replaceChildren(...buttons);

  section.append(header, list);
  return { section, buttons };
}

function setMenuOpen(isOpen) {
  document.body.classList.toggle("menu-open", isOpen);
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "章メニューを閉じる" : "章メニューを開く");
  chapterMenu.setAttribute("aria-hidden", String(!isOpen));
  menuBackdrop.hidden = !isOpen;
}

function updateActiveChapter() {
  if (talkOffsets.length === 0) {
    return;
  }

  const scrollTop = deviceScroll.scrollTop;
  let nextTalkKey = talkOffsets[0].talkKey;

  talkOffsets.forEach((target) => {
    if (target.top - 80 <= scrollTop) {
      nextTalkKey = target.talkKey;
    }
  });

  if (nextTalkKey === currentTalkKey) {
    return;
  }

  currentTalkKey = nextTalkKey;
  talkLinkElements.forEach((element) => {
    element.classList.toggle("is-current", element.dataset.talkKey === currentTalkKey);
  });
}

function sceneElement(scene, sceneIndex) {
  const section = document.createElement("section");
  section.className = "scene";
  section.dataset.sceneIndex = String(sceneIndex);
  section.dataset.mood = scene.mood;

  const visual = document.createElement("div");
  visual.className = "scene-visual";

  const image = document.createElement("img");
  image.className = "scene-image";
  image.src = scene.image;
  image.alt = scene.alt;
  image.loading = sceneIndex < 2 ? "eager" : "lazy";
  image.decoding = "async";

  const veil = document.createElement("div");
  veil.className = "scene-veil";

  const grain = document.createElement("div");
  grain.className = "scene-grain";

  const meta = document.createElement("div");
  meta.className = "scene-meta";

  const chapterLabel = document.createElement("p");
  chapterLabel.className = "scene-chapter";
  chapterLabel.textContent = scene.chapterTitle;

  const talkLabel = document.createElement("p");
  talkLabel.className = "scene-talk-index";
  talkLabel.textContent = scene.talkLabel;

  const title = document.createElement("h2");
  title.className = "scene-title";
  title.textContent = stripLeadingLabel(scene.talkTitle, scene.talkLabel);

  meta.append(chapterLabel, talkLabel, title);
  visual.append(image, veil, grain, meta);

  const copy = document.createElement("div");
  copy.className = "scene-copy";
  copy.append(...scene.beats.map((beat, beatIndex) => beatElement(beat, beatIndex)));

  section.append(visual, copy);
  return section;
}

function setActiveScene(index) {
  if (sceneElements.length === 0) {
    return;
  }

  const previousIndex = activeSceneIndex;
  activeSceneIndex = index;
  document.body.dataset.mood = story.scenes[index].mood;
  sceneElements[previousIndex]?.classList.remove("is-active");
  sceneElements[index]?.classList.add("is-active");
}

function nearestSceneIndex() {
  if (sceneMidpoints.length === 0) {
    return 0;
  }

  const anchor = deviceScroll.scrollTop + deviceScroll.clientHeight * 0.42;
  let low = 0;
  let high = sceneMidpoints.length - 1;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (sceneMidpoints[mid] < anchor) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  if (low === 0) {
    return 0;
  }

  return Math.abs(sceneMidpoints[low] - anchor) < Math.abs(sceneMidpoints[low - 1] - anchor)
    ? low
    : low - 1;
}

function cacheLayoutMetrics() {
  const viewportHeight = deviceScroll.clientHeight;
  sceneMidpoints = sceneElements.map(
    (element) => element.offsetTop + Math.min(element.offsetHeight, viewportHeight) * 0.5,
  );
  talkOffsets = talkTargets.map((target) => ({
    talkKey: target.talkKey,
    top: target.element.offsetTop,
  }));
}

function updateProgress() {
  const maxScroll = deviceScroll.scrollHeight - deviceScroll.clientHeight;
  const ratio = maxScroll <= 0 ? 0 : deviceScroll.scrollTop / maxScroll;
  progressBar.style.transform = `scaleX(${Math.max(0, Math.min(1, ratio))})`;

  const nextActiveIndex = nearestSceneIndex();
  if (nextActiveIndex !== activeSceneIndex) {
    setActiveScene(nextActiveIndex);
  }
  updateActiveChapter();
}

function syncReaderHeight() {
  novel.style.setProperty("--reader-height", `${deviceScroll.clientHeight}px`);
  cacheLayoutMetrics();
}

function onScroll() {
  if (ticking) {
    return;
  }

  ticking = true;
  window.requestAnimationFrame(() => {
    updateProgress();
    ticking = false;
  });
}

function render(storyData) {
  if (!storyData || !Array.isArray(storyData.scenes) || storyData.scenes.length === 0) {
    novel.innerHTML = '<div class="loading-state">表示できるシーンがありません。</div>';
    return;
  }

  document.title = storyData.title;
  const fragment = document.createDocumentFragment();
  fragment.append(titlePage(storyData));
  let previousTalkKey = null;

  storyData.scenes.forEach((scene, index) => {
    if (scene.talkKey !== previousTalkKey) {
      fragment.append(chapterMarker(scene));
      previousTalkKey = scene.talkKey;
    }
    fragment.append(sceneElement(scene, index));
  });

  const footer = document.createElement("footer");
  footer.className = "novel-footer";
  footer.innerHTML = `
    <p class="novel-finish-title">${storyData.title}</p>
    <p class="novel-finish">完</p>
  `;
  fragment.append(footer);

  novel.replaceChildren(fragment);
  sceneElements = [...document.querySelectorAll(".scene")];
  talkTargets = [...document.querySelectorAll(".chapter-marker")].map((element) => ({
    talkKey: element.dataset.talkKey,
    element,
  }));
  const menuTalkScenes = storyData.scenes.filter(
    (scene, index, scenes) => index === scenes.findIndex((candidate) => candidate.talkKey === scene.talkKey),
  );
  const menuGroups = [];
  talkLinkElements = [];

  menuTalkScenes.forEach((scene) => {
    const group = menuGroups[menuGroups.length - 1];
    if (!group || group.chapterKey !== scene.chapterKey) {
      menuGroups.push({
        chapterKey: scene.chapterKey,
        chapterScene: scene,
        talkScenes: [scene],
      });
      return;
    }
    group.talkScenes.push(scene);
  });

  const groupElements = menuGroups.map((group, index) => {
    const startIndex = menuGroups
      .slice(0, index)
      .reduce((count, item) => count + item.talkScenes.length, 0);
    const { section, buttons } = chapterMenuGroup(group.chapterScene, group.talkScenes, startIndex);
    talkLinkElements.push(...buttons);
    return section;
  });

  chapterMenuList.replaceChildren(...groupElements);
  syncReaderHeight();
  currentTalkKey = null;
  setActiveScene(0);
  updateProgress();
}

deviceScroll.addEventListener("scroll", onScroll, { passive: true });
window.addEventListener("resize", () => {
  syncReaderHeight();
  onScroll();
});
window.addEventListener("load", () => {
  syncReaderHeight();
  onScroll();
});

menuToggle.addEventListener("click", () => {
  setMenuOpen(chapterMenu.getAttribute("aria-hidden") === "true");
});

menuBackdrop.addEventListener("click", () => {
  setMenuOpen(false);
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setMenuOpen(false);
  }
});

render(story);
